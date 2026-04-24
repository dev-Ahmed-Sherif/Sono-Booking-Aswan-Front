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

const BASE = "cities";

/** Backend model uses `GovernateId` (PascalCase); JSON may expect `GovernateId` or camelCase `governateId`. */
function appendGovernorateKeys(
  payload: Record<string, string>,
  governorateId: string | undefined,
) {
  const g = governorateId?.trim();
  if (!g) return;
  payload.GovernateId = g;
  payload.governateId = g;
}

const addCity = async (data: {
  nameAr: string;
  nameEn?: string;
  code?: string;
  governorateId?: string;
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
    const payload: Record<string, string> = {
      code: (data.code && data.code.trim()) || "1",
      nameAr: data.nameAr,
    };
    if (data.nameEn != null && data.nameEn !== "")
      payload.nameEn = data.nameEn;
    appendGovernorateKeys(payload, data.governorateId);

    const res = await axios.post(
      `${process.env.BACK_END}/${BASE}/add`,
      payload,
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
    logApiError("addCity", error);
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
        message: err.response?.data?.message || "This city already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to add city",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getCities = async (governorateId?: string) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const url =
      governorateId && governorateId.trim() !== ""
        ? `${process.env.BACK_END}/${BASE}/getall?governorateId=${encodeURIComponent(governorateId.trim())}`
        : `${process.env.BACK_END}/${BASE}/getall`;
    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    logApiError("getCities", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get cities",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getCityById = async (id: string) => {
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
    logApiError("getCityById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: err.response?.data?.message || "Authentication failed.",
      };
    }
    return {
      error: "Failed to get city",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const updateCityById = async (data: {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  governorateId?: string;
}) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }
    const body: Record<string, string> = {
      id: data.id,
      code: data.code,
      nameAr: data.nameAr,
    };
    if (data.nameEn != null && data.nameEn !== "") body.nameEn = data.nameEn;
    appendGovernorateKeys(body, data.governorateId);

    const res = await axios.put(
      `${process.env.BACK_END}/${BASE}/update`,
      body,
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
    logApiError("updateCityById", error);
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
        message: err.response?.data?.message || "This city already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message: err.response?.data?.message || "Server error occurred.",
      };
    }
    return {
      error: "Failed to update city",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteCityById = async (id: string) => {
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
    logApiError("deleteCityById", error);
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
        message: err.response?.data?.message || "City not found.",
      };
    }
    return {
      error: "Failed to delete city",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteCityById = async (id: string) => {
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
    logApiError("softDeleteCityById", error);
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
        message: err.response?.data?.message || "City not found.",
      };
    }
    return {
      error: "Failed to soft delete city",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addCity,
  getCities,
  getCityById,
  updateCityById,
  deleteCityById,
  softDeleteCityById,
};
