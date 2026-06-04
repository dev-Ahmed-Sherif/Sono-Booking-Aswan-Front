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
  const safeError =
    error instanceof Error ? error : new Error(err.message ?? "Unknown error");
  console.error(
    `[${context}]`,
    err.response?.status,
    err.response?.data,
    safeError,
  );
}

const BASE = "organizations";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  return { accessToken };
}

export type PartiesOfficialPayload = {
  code?: string;
  nameAr: string;
  isReport?: boolean;
  address: string;
  phone: string;
  fax: string;
  mobile: string;
  email: string;
};

export const addPartiesOfficial = async (data: PartiesOfficialPayload) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("organizationType", "GovernmentCompany");

    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("addPartiesOfficial", e);
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

export const getPartiesOfficials = async (organizationType?: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const url = organizationType
      ? `${process.env.BACK_END}/${BASE}/getall?organizationType=${organizationType}`
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
    logApiError("getPartiesOfficials", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getPartiesOfficialById = async (id: string) => {
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
    logApiError("getPartiesOfficialById", e);
    return { error: "Failed", message: (e as Error).message };
  }
};

export const updatePartiesOfficialById = async (
  data: PartiesOfficialPayload & { id: string },
) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("organizationType", "GovernmentCompany");

    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("updatePartiesOfficialById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const deletePartiesOfficialById = async (id: string) => {
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
    logApiError("deletePartiesOfficialById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeletePartiesOfficialById = async (id: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.delete(
      `${process.env.BACK_END}/${BASE}/softdelete/${id}`,
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
    logApiError("softDeletePartiesOfficialById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
