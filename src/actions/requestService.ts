"use server";

import axios from "axios";
import { getUserData } from "@/actions/auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import {
  buildAddRequestFormData,
  type AddRequestDtoPayload,
} from "@/lib/housing-request-map";
import { fetchReportBlob } from "@/lib/report-fetch";

type Payload = Record<string, unknown>;

type AddOrUpdateRequestPayload = AddRequestDtoPayload & {
  status?: number | string;
};

type RequestOptions = {
  /** Sent as the `UserId` request header (`RequestsController.GetAllAsync`). */
  userId?: string;
};

const BASE = "Requests";

async function resolveUserId(userId?: string): Promise<string | undefined> {
  const trimmed = userId?.trim();
  if (trimmed) return trimmed;

  const result = await getUserData();
  if (result && typeof result === "object" && "error" in result) {
    return undefined;
  }

  const data = (result as { data?: { data?: Record<string, unknown> } })?.data
    ?.data;
  if (!data || typeof data !== "object") return undefined;

  const resolved = String(data.id ?? data.Id ?? "").trim();
  return resolved || undefined;
}

function extractMessageFromApiBody(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const direct = d.message ?? d.Message ?? d.title ?? d.Title;
  if (direct != null && String(direct).trim()) return String(direct).trim();

  const errors = d.errors ?? d.Errors;
  if (errors && typeof errors === "object") {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(
      errors as Record<string, unknown>,
    )) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        const text = String(item ?? "").trim();
        if (text) parts.push(field ? `${field}: ${text}` : text);
      }
    }
    if (parts.length > 0) return parts.join(" · ");
  }

  return undefined;
}

function mapAxiosRequestError(error: unknown): {
  error: string;
  message: string;
} {
  const err = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  const bodyMessage = extractMessageFromApiBody(err.response?.data);

  if (err.response?.status === 401) {
    return {
      error: "Unauthorized",
      message: bodyMessage || "يرجى تسجيل الدخول مرة أخرى.",
    };
  }
  return {
    error: "Request Failed",
    message: bodyMessage || err.message || "حدث خطأ غير متوقع",
  };
}

/** `RequestsController` add/update expect `[FromForm] AddRequestDto` — omit Content-Type for multipart. */
async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  options?: RequestOptions,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
    };
  }

  const isFormData = data instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    Authorization: `Bearer ${accessToken}`,
  };

  const resolvedUserId = options?.userId?.trim();
  if (resolvedUserId) {
    headers.UserId = resolvedUserId;
  }

  const config = {
    headers,
    withCredentials: true,
  };

  try {
    if (method === "get") {
      return toPlainSerializable((await axios.get(url, config)).data);
    }

    if (method === "delete") {
      return toPlainSerializable(
        (
          await axios.delete(url, {
            ...config,
            ...(data !== undefined ? { data } : {}),
          })
        ).data,
      );
    }

    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    return mapAxiosRequestError(error);
  }
}

const getRequests = async (userId?: string) => {
  const resolvedUserId = await resolveUserId(userId);
  return request("get", `${process.env.BACK_END}/${BASE}/getAll`, undefined, {
    userId: resolvedUserId,
  });
};

/** All requests for leader / housing sender (no `UserId` header). */
const getAllRequests = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getRequestById = async (id: string) =>
  id === "new"
    ? null
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getRequestsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getRequestsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addRequest = async (data: AddOrUpdateRequestPayload | FormData) =>
  request(
    "post",
    `${process.env.BACK_END}/${BASE}/add`,
    data instanceof FormData ? data : buildAddRequestFormData(data),
  );
const updateRequestById = async (data: AddOrUpdateRequestPayload | FormData) =>
  request(
    "put",
    `${process.env.BACK_END}/${BASE}/update`,
    data instanceof FormData ? data : buildAddRequestFormData(data),
  );
const deleteRequestById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteRequestById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);
const getRequestUnitsAll = async () =>
  request("get", `${process.env.BACK_END}/RequestUnits/getAll`);
/** Pass request owner's `userId` so leaders load that user's participants (via `UserId` header). */
const getRequestParticipantsAll = async (userId?: string) =>
  request(
    "get",
    `${process.env.BACK_END}/RequestParticipants/getAll`,
    undefined,
    { userId: userId?.trim() },
  );

const getRequestReport = async (data: {
  startDate: Date | string;
  endDate: Date | string;
  reportName: string;
  reportType: string;
}) =>
  fetchReportBlob(
    `${BASE}/getReport`,
    data,
    "تقرير الطلبات",
  );

export {
  addRequest,
  deleteRequestById,
  getAllRequests,
  getRequestById,
  getRequestParticipantsAll,
  getRequestReport,
  getRequests,
  getRequestsDropDown,
  getRequestUnitsAll,
  getRequestsPaged,
  softDeleteRequestById,
  updateRequestById,
};
