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

const BASE = "nationalities";

const addNationality = async (data: { nameAr: string; nameEn?: string }) => {
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
      { nameAr: data.nameAr, nameEn: data.nameEn },
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
    logApiError("addNationality", error);
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
          err.response?.data?.message || "This nationality already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to add nationality",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getNationalities = async () => {
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
    logApiError("getNationalities", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get nationalities",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getNationalityById = async (id: string) => {
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
    logApiError("getNationalityById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get nationality",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const updateNationalityById = async (data: {
  id: string;
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
      data,
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
    logApiError("updateNationalityById", error);
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
          err.response?.data?.message || "This nationality already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to update nationality",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteNationalityById = async (id: string) => {
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
    logApiError("deleteNationalityById", error);
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
        message: err.response?.data?.message || "Nationality not found.",
      };
    }
    return {
      error: "Failed to delete nationality",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteNationalityById = async (id: string) => {
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
    logApiError("softDeleteNationalityById", error);
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
        message: err.response?.data?.message || "Nationality not found.",
      };
    }
    return {
      error: "Failed to soft delete nationality",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addNationality,
  getNationalities,
  getNationalityById,
  updateNationalityById,
  deleteNationalityById,
  softDeleteNationalityById,
};
