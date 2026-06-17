"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;

const BASE = "Rooms";

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
        data?: unknown;
      };
      message?: string;
      code?: string;
    };

    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const data = err.response?.data;

    let messageFromBody: string | undefined;
    let validationErrors: Record<string, string[]> | undefined;
    let titleFromBody: string | undefined;
    let detailFromBody: string | undefined;
    let traceId: string | undefined;

    if (typeof data === "string") {
      messageFromBody = data;
    } else if (data && typeof data === "object") {
      const body = data as Record<string, unknown>;
      titleFromBody =
        typeof body.title === "string" ? body.title : undefined;
      detailFromBody =
        typeof body.detail === "string" ? body.detail : undefined;
      traceId =
        typeof body.traceId === "string" ? body.traceId : undefined;
      messageFromBody =
        (typeof body.message === "string" && body.message) ||
        (typeof body.Message === "string"
          ? (body.Message as string)
          : undefined) ||
        detailFromBody ||
        titleFromBody;

      const rawErrors = body.errors ?? body.Errors;
      if (rawErrors && typeof rawErrors === "object") {
        const normalized: Record<string, string[]> = {};
        Object.entries(rawErrors as Record<string, unknown>).forEach(
          ([field, value]) => {
            if (Array.isArray(value)) {
              normalized[field] = value.map((v) => String(v));
            } else if (value != null) {
              normalized[field] = [String(value)];
            }
          },
        );
        if (Object.keys(normalized).length > 0) validationErrors = normalized;
      }
    }

    const validationLines = validationErrors
      ? Object.entries(validationErrors).map(
          ([field, msgs]) => `${field}: ${msgs.join(" | ")}`,
        )
      : [];

    const composedMessage =
      [
        status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : null,
        messageFromBody,
        validationLines.length > 0 ? validationLines.join("\n") : null,
      ]
        .filter(Boolean)
        .join("\n") ||
      err.message ||
      "An unexpected error occurred";

    console.error("[roomService] request failed", {
      url,
      method,
      status,
      statusText,
      message: err.message,
      code: err.code,
      validationErrors,
      data,
    });

    return {
      error: "Request Failed",
      status,
      statusText,
      message: composedMessage,
      validationErrors,
      detail: data,
    };
  }
}

type GetRoomsOptions = {
  /**
   * When true, omits the availability `Status` header so authenticated callers
   * receive all rooms for the apartment (available, reserved, occupied).
   * Default keeps catalog behavior (available units only).
   */
  allStatuses?: boolean;
};

const getRooms = async (apartmentId?: string, options?: GetRoomsOptions) => {
  const trimmed = apartmentId?.trim();
  const headers: Record<string, string> = {};
  if (!options?.allStatuses) {
    headers.Status = AVAILABLE_UNIT_STATUS_HEADER;
  }
  if (trimmed) {
    headers.ApartmentId = trimmed;
  }
  return request(
    "get",
    `${process.env.BACK_END}/${BASE}/getAll`,
    undefined,
    Object.keys(headers).length > 0 ? headers : undefined,
  );
};
const getRoomById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getRoomsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getRoomsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addRoom = async (data: Payload | FormData) =>
  request(
    "post",
    `${process.env.BACK_END}/${BASE}/add`,
    data instanceof FormData ? data : toFormData(data),
  );
const updateRoomById = async (data: Payload | FormData) =>
  request(
    "put",
    `${process.env.BACK_END}/${BASE}/update`,
    data instanceof FormData ? data : toFormData(data),
  );
const deleteRoomById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteRoomById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);
const deleteRoomAttachmentsRange = async (ids: string[]) =>
  request(
    "delete",
    `${process.env.BACK_END}/${BASE}/deleteRange/attachments`,
    ids,
  );

export {
  addRoom,
  deleteRoomAttachmentsRange,
  deleteRoomById,
  getRoomById,
  getRooms,
  getRoomsDropDown,
  getRoomsPaged,
  softDeleteRoomById,
  updateRoomById,
};
