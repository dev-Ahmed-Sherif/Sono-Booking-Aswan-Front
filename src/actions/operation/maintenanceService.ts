"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type AxiosErrorResponse = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      title?: string;
      errors?: Record<string, string[]>;
      [key: string]: unknown;
    };
  };
  message?: string;
};

function logApiError(context: string, error: unknown) {
  const err = error as AxiosErrorResponse;
  const data = err.response?.data;
  console.error(
    `[${context}] status: ${err.response?.status ?? "N/A"}`,
    data ? JSON.stringify(data) : "",
    err.message ?? error,
  );
}

const BASE = "Maintenances";

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

export const addMaintenanceMultipart = async (formData: FormData) => {
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
    logApiError("addMaintenanceMultipart", e);
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

export const updateMaintenanceMultipart = async (formData: FormData) => {
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
    logApiError("updateMaintenanceMultipart", e);
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

export const getMaintenances = async () => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("getMaintenances", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getMaintenanceById = async (id: string) => {
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
    logApiError("getMaintenanceById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const deleteMaintenanceById = async (id: string) => {
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
    logApiError("deleteMaintenanceById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeleteMaintenanceById = async (id: string) => {
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
    logApiError("softDeleteMaintenanceById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
