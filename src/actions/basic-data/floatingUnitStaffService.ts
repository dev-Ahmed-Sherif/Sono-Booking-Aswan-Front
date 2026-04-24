"use server";

import axios from "axios";

import { getAccessToken } from "@/lib/token-helper";

export type { FloatingUnitStaffFormValues } from "./floatingUnitStaffFormData";

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

const BASE = "floatingUnitStaffs";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  return { accessToken };
}

/** Client should use `buildFloatingUnitStaffFormData` so `File` survives Server Actions. */
export const addFloatingUnitStaff = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      formData,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("addFloatingUnitStaff", e);
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

export const getFloatingUnitStaffs = async (floatingUnitId?: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const url = floatingUnitId
      ? `${process.env.BACK_END}/${BASE}/getall?floatingUnitId=${encodeURIComponent(floatingUnitId)}`
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
    logApiError("getFloatingUnitStaffs", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getFloatingUnitStaffById = async (id: string) => {
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
    logApiError("getFloatingUnitStaffById", e);
    return { error: "Failed", message: (e as Error).message };
  }
};

export const updateFloatingUnitStaffById = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      formData,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("updateFloatingUnitStaffById", e);
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

export const deleteFloatingUnitStaffById = async (id: string) => {
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
    logApiError("deleteFloatingUnitStaffById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeleteFloatingUnitStaffById = async (id: string) => {
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
    logApiError("softDeleteFloatingUnitStaffById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
