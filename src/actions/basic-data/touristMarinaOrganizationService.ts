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

const BASE = "touristMarinaOrganizations";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  return { accessToken };
}

export type TouristMarinaOrganizationPayload = {
  id?: string;
  licenseNumber: string;
  touristMarinaId: string;
  organizationId: string;
  fromDate: string;
  toDate: string;
  isActive?: boolean;
};

export const addTouristMarinaOrganization = async (
  payload: TouristMarinaOrganizationPayload,
) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.post(`${process.env.BACK_END}/${BASE}/add`, payload, {
      withCredentials: true,
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("addTouristMarinaOrganization", e);
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

export const getTouristMarinaOrganizations = async (touristMarinaId?: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const url = touristMarinaId
      ? `${process.env.BACK_END}/${BASE}/getall?touristMarinaId=${touristMarinaId}`
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
    logApiError("getTouristMarinaOrganizations", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getTouristMarinaOrganizationById = async (id: string) => {
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
    logApiError("getTouristMarinaOrganizationById", e);
    return { error: "Failed", message: (e as Error).message };
  }
};

export const updateTouristMarinaOrganizationById = async (
  payload: TouristMarinaOrganizationPayload,
) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      payload,
      {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      },
    );
    return res.data;
  } catch (e: unknown) {
    logApiError("updateTouristMarinaOrganizationById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const deleteTouristMarinaOrganizationById = async (id: string) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const res = await axios.delete(`${process.env.BACK_END}/${BASE}/delete/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (e: unknown) {
    logApiError("deleteTouristMarinaOrganizationById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeleteTouristMarinaOrganizationById = async (id: string) => {
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
    logApiError("softDeleteTouristMarinaOrganizationById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
