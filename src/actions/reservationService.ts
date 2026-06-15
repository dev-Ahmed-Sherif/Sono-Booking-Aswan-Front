"use server";

import axios from "axios";
import { getUserData } from "@/actions/auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import type {
  AddReservationDtoPayload,
  ReservationPagedFilterPayload,
} from "@/lib/reservation-map";
import { fetchReportBlob } from "@/lib/report-fetch";

type Payload = Record<string, unknown>;

type RequestOptions = {
  /**
   * Sent as the `UserId` request header.
   * `Reservations/getAll` filters by `Request.UserId` when set.
   */
  userId?: string;
};

const BASE = "Reservations";

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

function mapAxiosReservationError(error: unknown): {
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
    if (method === "get" || method === "delete") {
      return toPlainSerializable((await axios[method](url, config)).data);
    }
    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    return mapAxiosReservationError(error);
  }
}

/** Current user's reservations (`UserId` header from session when omitted). */
const getReservations = async (userId?: string) => {
  const resolvedUserId = await resolveUserId(userId);
  return request("get", `${process.env.BACK_END}/${BASE}/getAll`, undefined, {
    userId: resolvedUserId,
  });
};

/** All reservations (housing receiver / admin — no `UserId` header). */
const getAllReservations = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`);

const getReservationById = async (id: string) =>
  id === "new"
    ? null
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);

const getReservationsPaged = async (filter: ReservationPagedFilterPayload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);

const addReservation = async (data: AddReservationDtoPayload | Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/add`, data);

/** Backend `UpdateAsync` accepts `AddReservationDto` (same shape as add). */
const updateReservationById = async (data: AddReservationDtoPayload | Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);

const deleteReservationById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);

const softDeleteReservationById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

const getReservationReport = async (data: {
  startDate: Date | string;
  endDate: Date | string;
  reportName: string;
  reportType: string;
  reservationStatus?: string | number;
}) =>
  fetchReportBlob(
    `${BASE}/getReport`,
    data,
    "تقرير تفاصيل الحجوزات",
  );

export {
  addReservation,
  deleteReservationById,
  getAllReservations,
  getReservationById,
  getReservationReport,
  getReservations,
  getReservationsPaged,
  softDeleteReservationById,
  updateReservationById,
};
