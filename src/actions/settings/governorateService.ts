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

const BASE = "governorates";

const normalizeGovernorateFormData = (formData: FormData) => {
  const legacyUrl = formData.get("url");
  const websiteUrl = formData.get("websiteUrl");

  // Backward compatibility: migrate old key `url` to `websiteUrl`.
  if (!websiteUrl && typeof legacyUrl === "string" && legacyUrl.trim() !== "") {
    formData.append("websiteUrl", legacyUrl);
  }
  formData.delete("url");
};

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  return { accessToken };
}

export const addGovernorate = async (data: {
  nameAr: string;
  nameEn?: string;
}) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.post(`${process.env.BACK_END}/${BASE}/add`, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("addGovernorate", e);
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

/** Must receive `FormData` from client for file upload (image). */
export type GovernoratePayload = {
  id?: string;
  nameAr: string;
  nameEn: string;
  code: string;
  address?: string;
  websiteUrl?: string;
  imageUrl?: File;
};

export const addGovernorateMultipart = async (formData: FormData) => {
  normalizeGovernorateFormData(formData);
  console.log(
    "formData entries",
    Array.from(formData.entries()).map(([k, v]) => [
      k,
      v instanceof File ? `[File:${v.name}]` : v,
    ]),
  );
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
    logApiError("addGovernorateMultipart", e);
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

export const getGovernorates = async () => {
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
    logApiError("getGovernorates", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getGovernorateById = async (id: string) => {
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
    logApiError("getGovernorateById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const updateGovernorateById = async (data: {
  id: string;
  nameAr: string;
  nameEn?: string;
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
    logApiError("updateGovernorateById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const updateGovernorateMultipartById = async (formData: FormData) => {
  normalizeGovernorateFormData(formData);
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
    logApiError("updateGovernorateMultipartById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const deleteGovernorateById = async (id: string) => {
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
    logApiError("deleteGovernorateById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeleteGovernorateById = async (id: string) => {
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
    logApiError("softDeleteGovernorateById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
