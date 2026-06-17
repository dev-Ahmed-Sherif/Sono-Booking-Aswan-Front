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

const BASE = "InspectionFloatingUnitClauses";

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

const addInspectionFloatingUnitClause = async (data: {
  isInspected: boolean;
  number?: string;
  note?: string;
  inspectionId: string;
  inspectionClauseId: string;
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
    logApiError("addInspectionFloatingUnitClause", e);
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

const updateInspectionFloatingUnitClauseById = async (data: {
  id: string;
  isInspected: boolean;
  number?: string;
  note?: string;
  inspectionId: string;
  inspectionClauseId: string;
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
    logApiError("updateInspectionFloatingUnitClauseById", e);
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

const getInspectionFloatingUnitClauses = async (inspectionId?: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;

  try {
    const url = inspectionId
      ? `${process.env.BACK_END}/${BASE}/getall?inspectionId=${inspectionId}`
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
    logApiError("getInspectionFloatingUnitClauses", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspection floating unit clauses",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const getInspectionFloatingUnitClauseById = async (id: string) => {
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
    logApiError("getInspectionFloatingUnitClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to get inspection floating unit clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const deleteInspectionFloatingUnitClauseById = async (id: string) => {
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
    logApiError("deleteInspectionFloatingUnitClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to delete inspection floating unit clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

const softDeleteInspectionFloatingUnitClauseById = async (id: string) => {
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
    logApiError("softDeleteInspectionFloatingUnitClauseById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed to soft delete inspection floating unit clause",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        (e as Error).message,
    };
  }
};

export {
  addInspectionFloatingUnitClause,
  updateInspectionFloatingUnitClauseById,
  getInspectionFloatingUnitClauses,
  getInspectionFloatingUnitClauseById,
  deleteInspectionFloatingUnitClauseById,
  softDeleteInspectionFloatingUnitClauseById,
};
