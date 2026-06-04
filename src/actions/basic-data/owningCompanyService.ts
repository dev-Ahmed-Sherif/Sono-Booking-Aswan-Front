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

export type OwningCompanyPayload = {
  code?: string;
  nameAr: string;
  nameEn?: string;
  address: string;
  nationalityId: string;
  phone: string;
  fax: string;
  mobile: string;
  email: string;
  website?: string;
  commercialRegistrationNumber: string;
  commercialRegistrationAttachment?: File;
  touristMarinaNumber: string;
  isAccepted: boolean;
  organizationCategoryId?: string;
};

/**
 * Must receive `FormData` built on the client — passing `{ ...values, file }` breaks
 * Next.js Server Action serialization. Include `organizationCategoryId` in FormData when required.
 */
export const addOwningCompany = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    formData.append("organizationType", "OwnerCompany");

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
    logApiError("addOwningCompany", e);
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

export const getOwningCompanies = async (
  organizationCategoryId?: string,
  organizationType?: string,
) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    const params = new URLSearchParams();
    if (organizationCategoryId) {
      params.set("organizationCategoryId", organizationCategoryId);
    }
    if (organizationType) {
      params.set("organizationType", organizationType);
    }
    const qs = params.toString();
    const url = qs
      ? `${process.env.BACK_END}/${BASE}/getall?${qs}`
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
    logApiError("getOwningCompanies", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const getOwningCompanyById = async (id: string) => {
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
    logApiError("getOwningCompanyById", e);
    return { error: "Failed", message: (e as Error).message };
  }
};

export const updateOwningCompanyById = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
    formData.append("organizationType", "OwnerCompany");

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
    logApiError("updateOwningCompanyById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const deleteOwningCompanyById = async (id: string) => {
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
    logApiError("deleteOwningCompanyById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};

export const softDeleteOwningCompanyById = async (id: string) => {
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
    logApiError("softDeleteOwningCompanyById", e);
    const err = e as AxiosErrorResponse;
    return {
      error: "Failed",
      message: err.response?.data?.message || (e as Error).message,
    };
  }
};
