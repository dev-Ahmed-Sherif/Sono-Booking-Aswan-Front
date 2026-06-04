"use server";

import axios from "axios";

import { getAccessToken } from "@/lib/token-helper";

type AxiosErrorResponse = {
  response?: {
    status?: number;
    data?: { message?: string; error?: string; [key: string]: unknown };
  };
  message?: string;
};

function logApiError(context: string, error: unknown) {
  const err = error as AxiosErrorResponse;
  console.error(
    `[${context}]`,
    err.response?.status,
    err.response?.data,
    err.message ?? error,
  );
}

const BASE = "inspections";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }
  return { accessToken };
}

const addInspection = async (data: { nameAr: string; nameEn?: string }) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      { code: "1", nameAr: data.nameAr, nameEn: data.nameEn },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("addInspection", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const updateInspectionById = async (data: {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
}) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      {
        id: data.id,
        code: data.code,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("updateInspectionById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const getInspections = async (inspectionTypeId?: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const url = inspectionTypeId
      ? `${process.env.BACK_END}/${BASE}/getall?inspectionTypeId=${inspectionTypeId}`
      : `${process.env.BACK_END}/${BASE}/getall`;
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("getInspections", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspections",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const getInspectionById = async (id: string) => {
  if (id === "new") return undefined;

  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("getInspectionById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspection",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const deleteInspectionById = async (id: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.delete(
      `${process.env.BACK_END}/${BASE}/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("deleteInspectionById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to delete inspection",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const softDeleteInspectionById = async (id: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.delete(
      `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("softDeleteInspectionById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to soft delete inspection",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const addInspectionMultipart = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      formData,
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("addInspectionMultipart", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const updateInspectionMultipart = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      formData,
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("updateInspectionMultipart", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

export {
  addInspection,
  updateInspectionById,
  getInspections,
  getInspectionById,
  deleteInspectionById,
  softDeleteInspectionById,
  addInspectionMultipart,
  updateInspectionMultipart,
};
