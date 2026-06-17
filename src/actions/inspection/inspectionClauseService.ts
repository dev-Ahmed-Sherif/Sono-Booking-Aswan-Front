"use server";

import axios from "@/lib/axios-auth";
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

const BASE = "InspectionClauses";

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

const addInspectionClause = async (data: {
  code: string;
  name: string;
  parentId?: string;
  inspectionTypeId: string;
}) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      data,
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
    logApiError("addInspectionClause", e);
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

const updateInspectionClauseById = async (data: {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  inspectionTypeId: string;
}) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      data,
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
    logApiError("updateInspectionClauseById", e);
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

const getInspectionClauses = async (inspectionTypeId?: string) => {
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
    logApiError("getInspectionClauses", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspection clauses",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const getInspectionClauseById = async (id: string) => {
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
    logApiError("getInspectionClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspection clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const deleteInspectionClauseById = async (id: string) => {
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
    logApiError("deleteInspectionClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to delete inspection clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const softDeleteInspectionClauseById = async (id: string) => {
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
    logApiError("softDeleteInspectionClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to soft delete inspection clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

export {
  addInspectionClause,
  updateInspectionClauseById,
  getInspectionClauses,
  getInspectionClauseById,
  deleteInspectionClauseById,
  softDeleteInspectionClauseById,
};
