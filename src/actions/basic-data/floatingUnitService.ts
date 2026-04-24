"use server";

import axios from "axios";

import { getAccessToken } from "@/lib/token-helper";

export type { FloatingUnitFormValues } from "./floatingUnitFormData";

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

const BASE = "floatingunits";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  return { accessToken };
}

const addFloatingUnit = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
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
    logApiError("addFloatingUnit", e);
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

const updateFloatingUnitById = async (formData: FormData) => {
  const auth = await withAuth();
  if ("error" in auth) return auth;
  try {
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
    logApiError("updateFloatingUnitById", e);
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

const getFloatingUnits = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}/floatingunits/getall`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return res.data;
  } catch (error: any) {
    console.error("Error getting floating units:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get floating units",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const getFloatingUnitById = async (id: string) => {
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

    const res = await axios.get(
      `${process.env.BACK_END}/floatingunits/get/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return res.data;
  } catch (error: any) {
    console.error("Error getting floating unit by id:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get floating unit",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteFloatingUnitAttachmentsByAttachId = async (attachIds: any) => {
  try {
    // Validate input
    if (!attachIds || !Array.isArray(attachIds) || attachIds.length === 0) {
      return {
        error: "Validation Error",
        message: "Attachment IDs are required and must be a non-empty array.",
      };
    }

    // Ensure all IDs are strings (backend might expect string format)
    const validIds = attachIds
      .map((id) => String(id))
      .filter((id) => id && id.trim() !== "");

    if (validIds.length === 0) {
      return {
        error: "Validation Error",
        message: "No valid attachment IDs provided.",
      };
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    console.log("Deleting attachments with IDs:", validIds);

    const res = await axios.delete(
      `${process.env.BACK_END}/floatingunits/deleteRange/Attachment`,
      {
        data: validIds, // Send array directly, not wrapped in an object
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return res.data;
  } catch (error: any) {
    console.error("Error deleting floating unit attachments:", error);

    // Enhanced error logging
    if (error.response?.data) {
      console.error("Error response data:", error.response.data);
      if (error.response.data.errors) {
        console.error("Validation errors:", error.response.data.errors);
      }
    }

    if (error.response?.status === 400) {
      // Handle validation errors
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.title ||
        "Validation error occurred";
      const errors = error.response?.data?.errors;
      return {
        error: "Validation Error",
        message: errors
          ? `${errorMessage}: ${JSON.stringify(errors)}`
          : errorMessage,
        validationErrors: errors,
      };
    }

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to delete attachments",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteFloatingUnitById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END_DEV}/floatingunits/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: any) {
    console.error("Error deleting floating unit:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "Floating unit not found.",
      };
    }

    return {
      error: "Failed to delete floating unit",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteFloatingUnitById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END_DEV}/floatingunits/softdelete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: any) {
    console.error("Error soft deleting floating unit:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "Floating unit not found.",
      };
    }

    return {
      error: "Failed to soft delete floating unit",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const getReport = async (data: {
  startDate: Date | string;
  endDate: Date | string;
  technicalJobTypeId?: string;
  reportName: string;
  reportType: string;
}) => {
  try {
    const { startDate, endDate, technicalJobTypeId, reportName, reportType } =
      data;

    // Validate required fields
    if (!startDate || !endDate || !reportName || !reportType) {
      return {
        error: "Validation Error",
        message: "startDate, endDate, reportName, and reportType are required.",
      };
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    // Format dates to string if they are Date objects
    const formatDate = (date: Date | string): string => {
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      return String(date);
    };

    // Build query parameters
    const params = new URLSearchParams();
    params.append("startDate", formatDate(startDate));
    params.append("endDate", formatDate(endDate));
    params.append("reportName", String(reportName));
    params.append("reportType", String(reportType));

    if (
      technicalJobTypeId !== undefined &&
      technicalJobTypeId !== null &&
      technicalJobTypeId !== ""
    ) {
      params.append("technicalJobTypeId", String(technicalJobTypeId));
    }

    const res = await axios.get(
      `${
        process.env.BACK_END_DEV
      }/floatingunits/getreport?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
        responseType: "arraybuffer", // Use arraybuffer for reliable binary data handling in Node.js
      },
    );

    // Return blob data as base64 string for reliable serialization
    // With responseType: "arraybuffer", res.data is an ArrayBuffer
    // Convert to base64 for safe serialization through server actions
    const buffer = Buffer.from(res.data);

    // Verify buffer has data
    if (!buffer || buffer.length === 0) {
      return {
        error: "Empty Response",
        message: "The server returned an empty file.",
      };
    }

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${
      res.headers["content-type"] || "application/pdf"
    };base64,${base64}`;

    // Parse filename from Content-Disposition header
    let filename = `تقرير المهام الفنية.${reportType}`;
    if (res.headers["content-disposition"]) {
      const contentDisposition = res.headers["content-disposition"];
      // Handle UTF-8 encoded filenames (e.g., filename*=UTF-8''filename)
      const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
      if (utf8Match) {
        const decodedFilename = decodeURIComponent(utf8Match[1]);
        // Extract file extension from decoded filename
        const fileExtension = decodedFilename.split(".").pop() || reportType;
        // Replace with Arabic name while preserving extension
        filename = `تقرير المهام الفنية.${fileExtension}`;
        // console.log("if filename :", filename);
      } else {
        // Handle regular filename (e.g., filename="filename" or filename=filename)
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
        );
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, "").trim();
          // Remove any extra parts like "; filename_=..." that might be present
          filename = filename.split(";")[0].trim();
          // Extract file extension from filename
          const fileExtension = filename.split(".").pop() || reportType;
          // Replace with Arabic name while preserving extension
          filename = `تقرير المهام الفنية.${fileExtension}`;
          // console.log("else filename :", filename);
        }
      }
    }

    // Return the base64 data URL along with content type and filename
    return {
      data: dataUrl, // Base64 data URL - can be used directly or converted to Blob
      contentType: res.headers["content-type"] || "application/pdf",
      filename: filename,
    };
  } catch (error: any) {
    console.error("Error getting report:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 400) {
      return {
        error: "Bad Request",
        message:
          error.response?.data?.message ||
          "Invalid request parameters. Please check your input.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "Report endpoint not found.",
      };
    }

    return {
      error: "Failed to get report",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addFloatingUnit,
  updateFloatingUnitById,
  getFloatingUnits,
  getFloatingUnitById,
  deleteFloatingUnitById,
  softDeleteFloatingUnitById,
  deleteFloatingUnitAttachmentsByAttachId,
  getReport,
};
