"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;

const BASE = "Apartments";

/** Backend accepts "متاح" or "Available"; ASCII avoids header encoding issues from Node. */
const AVAILABLE_UNIT_STATUS_HEADER = "Available";

function toFormData(payload: Payload): FormData {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null) return;
        if (item instanceof File) {
          formData.append(key, item);
        } else {
          formData.append(key, String(item));
        }
      });
      return;
    }

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
}

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  extraHeaders?: Record<string, string>,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  const isFormData = data instanceof FormData;
  const config = {
    withCredentials: true,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${accessToken}`,
      ...(extraHeaders ?? {}),
    },
  };

  try {
    if (method === "get") {
      const res = await axios.get(url, config);
      return res.data;
    }

    if (method === "delete") {
      const res = await axios.delete(url, {
        ...config,
        ...(data !== undefined ? { data } : {}),
      });
      return res.data;
    }

    const res = await axios[method](url, data, config);
    return res.data;
  } catch (error: unknown) {
    const err = error as {
      response?: {
        status?: number;
        statusText?: string;
        data?: {
          message?: string;
          error?: string;
          title?: string;
          errors?: Record<string, string[] | string>;
          [key: string]: unknown;
        };
      };
      config?: { url?: string; method?: string };
      message?: string;
      code?: string;
    };
    const responseData = err.response?.data;
    const validationErrors = responseData?.errors;
    const flattenedValidationErrors = validationErrors
      ? Object.entries(validationErrors).map(([field, issues]) => ({
          field,
          issues: Array.isArray(issues) ? issues : [String(issues)],
        }))
      : [];
    console.error("[apartmentsService.request] API error details", {
      request: {
        method: String(err.config?.method ?? method).toUpperCase(),
        url: err.config?.url ?? url,
      },
      response: {
        status: err.response?.status,
        statusText: err.response?.statusText,
        message: responseData?.message,
        error: responseData?.error,
        title: responseData?.title,
      },
      validationErrors: flattenedValidationErrors,
      backendPayload: responseData,
      axiosCode: err.code,
      transportMessage: err.message,
    });
    const status = err.response?.status;
    const message =
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred";
    return {
      error: status ? `Request Failed (${status})` : "Request Failed",
      message,
    };
  }
}

const getApartments = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`, undefined, {
    Status: AVAILABLE_UNIT_STATUS_HEADER,
  });
const getApartmentById = async (id: string) =>
  id === "new"
    ? undefined
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getApartmentsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getApartmentsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addApartment = async (data: Payload | FormData) =>
  request(
    "post",
    `${process.env.BACK_END}/${BASE}/add`,
    data instanceof FormData ? data : toFormData(data),
  );
const updateApartmentById = async (data: Payload | FormData) =>
  request(
    "put",
    `${process.env.BACK_END}/${BASE}/update`,
    data instanceof FormData ? data : toFormData(data),
  );
const deleteApartmentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteApartmentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);
const deleteApartmentAttachmentsRange = async (ids: string[]) =>
  request(
    "delete",
    `${process.env.BACK_END}/${BASE}/deleteRange/attachments`,
    ids,
  );

export {
  addApartment,
  deleteApartmentAttachmentsRange,
  deleteApartmentById,
  getApartmentById,
  getApartments,
  getApartmentsDropDown,
  getApartmentsPaged,
  softDeleteApartmentById,
  updateApartmentById,
};
