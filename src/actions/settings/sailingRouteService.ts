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

const addSailingRoute = async (data: { nameAr: string; nameEn?: string }) => {
  try {
    const { nameAr, nameEn } = data;

    if (!nameAr) {
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
      `${process.env.BACK_END}/routes/add`,
      { code: "1", nameAr, nameEn },
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
    logApiError("addSailingRoute", error);
    const err = error as AxiosErrorResponse;

    if (err.response?.status === 400) {
      return {
        error: "Bad Request",
        message:
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid data provided. Please check your input and try again.",
      };
    }
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message || "This sailing route already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          err.response?.data?.message ||
          "Server error occurred. Please try again.",
      };
    }
    return {
      error: "Failed to add sailing route",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getSailingRoutes = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/routes/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    logApiError("getSailingRoutes", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to get sailing routes",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getSailingRouteById = async (id: string) => {
  try {
    if (id === "new") {
      return undefined;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/routes/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    logApiError("getSailingRouteById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to get sailing route",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const updateSailingRouteById = async (data: {
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

    const res = await axios.put(`${process.env.BACK_END}/routes/update`, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    logApiError("updateSailingRouteById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message || "This sailing route already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          err.response?.data?.message ||
          "Server error occurred. Please try again.",
      };
    }
    return {
      error: "Failed to update sailing route",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteSailingRouteById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/routes/delete/${id}`,
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
    logApiError("deleteSailingRouteById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message: err.response?.data?.message || "Sailing route not found.",
      };
    }
    return {
      error: "Failed to delete sailing route",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteSailingRouteById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/routes/deleteSoft/${id}`,
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
    logApiError("softDeleteSailingRouteById", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message: err.response?.data?.message || "Sailing route not found.",
      };
    }
    return {
      error: "Failed to soft delete sailing route",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addSailingRoute,
  getSailingRoutes,
  getSailingRouteById,
  updateSailingRouteById,
  deleteSailingRouteById,
  softDeleteSailingRouteById,
};
