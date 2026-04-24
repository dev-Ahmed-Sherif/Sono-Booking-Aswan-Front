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
  const status = err.response?.status;
  console.error(`[${context}] status: ${status ?? "N/A"}`);
  if (data) {
    console.error(`[${context}] title:`, data.title ?? "N/A");
    console.error(`[${context}] message:`, data.message ?? data.error ?? "N/A");
    if (data.errors && typeof data.errors === "object") {
      console.error(
        `[${context}] validation errors:`,
        JSON.stringify(data.errors, null, 2),
      );
    }
    console.error(`[${context}] full response:`, JSON.stringify(data, null, 2));
  }
  console.error(`[${context}] raw error:`, err.message ?? error);
}

const BASE = "organizationcategories";

const addOrganizationCategory = async (data: {
  nameAr: string;
  nameEn?: string;
}) => {
  try {
    if (!data.nameAr) {
      return {
        error: "Validation Error",
        message: "Name (Arabic) is required.",
      };
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      { code: "1", nameAr: data.nameAr, nameEn: data.nameEn },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    logApiError("addOrganizationCategory", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 400) {
      return {
        error: "Bad Request",
        message:
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid data provided.",
      };
    }
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message ||
          "This organization category already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to add organization category",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getOrganizationCategories = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    logApiError("getOrganizationCategories", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get organization categories",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getOrganizationCategoryById = async (id: string) => {
  try {
    if (id === "new") return undefined;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    logApiError("getOrganizationCategoryById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get organization category",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const updateOrganizationCategoryById = async (data: {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
}) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
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
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    logApiError("updateOrganizationCategoryById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message ||
          "This organization category already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to update organization category",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteOrganizationCategoryById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const res = await axios.delete(
      `${process.env.BACK_END}/${BASE}/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    logApiError("deleteOrganizationCategoryById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message:
          err.response?.data?.message || "Organization category not found.",
      };
    }
    return {
      error: "Failed to delete organization category",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteOrganizationCategoryById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const res = await axios.delete(
      `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    logApiError("softDeleteOrganizationCategoryById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message:
          err.response?.data?.message || "Organization category not found.",
      };
    }
    return {
      error: "Failed to soft delete organization category",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addOrganizationCategory,
  getOrganizationCategories,
  getOrganizationCategoryById,
  updateOrganizationCategoryById,
  deleteOrganizationCategoryById,
  softDeleteOrganizationCategoryById,
};
