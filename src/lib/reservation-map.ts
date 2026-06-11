import { getLookupArray } from "@/lib/availability-inquiry";
import {
  extractNightsFromRequest,
  toYmd,
} from "@/lib/housing-request-list";

/**
 * Mirrors `SonoBooking.Domain.ReservationStatus`.
 * Keep backward-compatible numeric support because existing DB rows may contain legacy values.
 */
export type ReservationStatus = 1 | 2 | 3 | 4 | 5;

export const RESERVATION_STATUS_RESERVED = 1 as const satisfies ReservationStatus;
export const RESERVATION_STATUS_COMPLETED = 2 as const satisfies ReservationStatus;
export const RESERVATION_STATUS_CANCELED = 3 as const satisfies ReservationStatus;
export const RESERVATION_STATUS_NO_SHOW = 4 as const satisfies ReservationStatus;
export const RESERVATION_STATUS_CHECKOUT = 5 as const satisfies ReservationStatus;

/** @deprecated Legacy API value; treated as `Completed`. */
export const RESERVATION_STATUS_CHECKED_IN =
  RESERVATION_STATUS_COMPLETED;

/** EF / API enum member names (`StringEnumConverter`). */
export function reservationStatusToApiName(
  status: ReservationStatus,
): "Reserved" | "Completed" | "Canceled" | "NoShow" | "Checkout" {
  switch (status) {
    case RESERVATION_STATUS_COMPLETED:
      return "Completed";
    case RESERVATION_STATUS_CANCELED:
      return "Canceled";
    case RESERVATION_STATUS_NO_SHOW:
      return "NoShow";
    case RESERVATION_STATUS_CHECKOUT:
      return "Checkout";
    default:
      return "Reserved";
  }
}

/** API uses `StringEnumConverter` — status is `"Reserved"`, not `1`. */
const RESERVATION_STATUS_BY_API_NAME: Record<string, ReservationStatus> = {
  reserved: 1,
  completed: 2,
  checkedin: 2,
  canceled: 3,
  cancelled: 3,
  noshow: 4,
  checkout: 5,
  محجوز: 1,
  "تم اكتمال الاقامة": 2,
  "تأكيد وصول": 2,
  ملغى: 3,
  "لم يظهر": 4,
  "تسجيل مغادرة": 5,
  مغادرة: 5,
};

/**
 * Mirrors `SonoBooking.Common.DTO.Housing.Reservation.AddReservationDto`.
 * `totalAmount` is recalculated on the server from request units (bed/room/apartment
 * prices × request nights); use `computeReservationTotalAmountPreview` for UI only.
 */
export type AddReservationDtoPayload = {
  id?: string;
  startDate: string;
  endDate: string;
  checkInDate?: string | null;
  actualCheckOutDate?: string | null;
  cancelationReason?: string | null;
  status: ReservationStatus;
  /** Ignored by API on add/update — send `0` or a preview value. */
  totalAmount: number;
  requestId: string;
};

/** Mirrors `SonoBooking.Common.DTO.Housing.Reservation.ReservationDto`. */
export type ReservationDtoPayload = Omit<AddReservationDtoPayload, "requestId"> & {
  requestId?: string;
  cancelationReason?: string;
  userId?: string;
  createdAt?: string;
  createdById?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedById?: string;
  modifiedBy?: string;
  isDeleted?: boolean;
};

/** Mirrors `BaseParam<ReservationFilter>` for `Reservations/getPaged`. */
export type ReservationPagedFilterPayload = {
  pageNumber: number;
  pageSize: number;
  filter?: {
    nameEn?: string;
    nameAr?: string;
    name?: string;
    isDeleted?: boolean;
  };
  orderByValue?: Array<{
    colId?: string;
    sort?: string;
  }>;
};

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = r[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function pickNum(r: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = r[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickReservationStatus(
  r: Record<string, unknown>,
): ReservationStatus | undefined {
  const n = pickNum(r, "status", "Status");
  if (n != null && n >= 1 && n <= 5) return n as ReservationStatus;

  const raw = pickStr(r, "status", "Status");
  if (!raw) return undefined;

  const direct = RESERVATION_STATUS_BY_API_NAME[raw];
  if (direct != null) return direct;

  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  const mapped = RESERVATION_STATUS_BY_API_NAME[normalized];
  if (mapped != null) return mapped;

  return undefined;
}

function pickIsoDateValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const y = Number(o.year ?? o.Year);
    const m = Number(o.month ?? o.Month);
    const d = Number(o.day ?? o.Day);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const raw = String(value).trim();
  if (!raw) return "";
  const ymd = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : "";
}

function pickIsoDate(r: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const ymd = pickIsoDateValue(r[key]);
    if (ymd) return ymd;
  }
  return "";
}

function pickIsoDateTime(
  r: Record<string, unknown>,
  ...keys: string[]
): string | null {
  const raw = pickStr(r, ...keys);
  return raw || null;
}

/** Parses API row (`ReservationDto`) with camelCase or PascalCase keys. */
export function parseReservationFromApi(
  raw: Record<string, unknown>,
): ReservationDtoPayload | null {
  const id = pickStr(raw, "id", "Id");
  const nestedRequest = (raw.request ?? raw.Request) as
    | Record<string, unknown>
    | undefined;
  const requestId =
    pickStr(raw, "requestId", "RequestId") ||
    (nestedRequest
      ? pickStr(nestedRequest, "id", "Id", "requestId", "RequestId")
      : "");
  const startDate = pickIsoDate(raw, "startDate", "StartDate");
  const endDate = pickIsoDate(raw, "endDate", "EndDate");
  const status = pickReservationStatus(raw) ?? RESERVATION_STATUS_RESERVED;

  if (!id || !startDate || !endDate) {
    return null;
  }

  const totalAmount = pickNum(raw, "totalAmount", "TotalAmount") ?? 0;

  return {
    id,
    requestId: requestId || undefined,
    startDate,
    endDate,
    status,
    totalAmount,
    cancelationReason:
      pickStr(raw, "cancelationReason", "CancelationReason") || undefined,
    checkInDate: pickIsoDateTime(raw, "checkInDate", "CheckInDate"),
    actualCheckOutDate: pickIsoDateTime(
      raw,
      "actualCheckOutDate",
      "ActualCheckOutDate",
    ),
    userId: pickStr(raw, "userId", "UserId") || undefined,
    createdAt: pickStr(raw, "createdAt", "CreatedAt") || undefined,
    createdById: pickStr(raw, "createdById", "CreatedById") || undefined,
    createdBy: pickStr(raw, "createdBy", "CreatedBy") || undefined,
    modifiedAt: pickStr(raw, "modifiedAt", "ModifiedAt") || undefined,
    modifiedById: pickStr(raw, "modifiedById", "ModifiedById") || undefined,
    modifiedBy: pickStr(raw, "modifiedBy", "ModifiedBy") || undefined,
    isDeleted: Boolean(raw.isDeleted ?? raw.IsDeleted ?? false),
  };
}

/** Serializes `AddReservationDto` for `Reservations/add` and `Reservations/update`. */
export function serializeAddReservationDtoForApi(
  payload: AddReservationDtoPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: reservationStatusToApiName(payload.status),
    totalAmount: payload.totalAmount,
    requestId: payload.requestId.trim(),
  };

  const id = payload.id?.trim();
  if (id) body.id = id;

  if (payload.checkInDate) body.checkInDate = payload.checkInDate;
  if (payload.actualCheckOutDate === null) {
    body.actualCheckOutDate = null;
  } else if (payload.actualCheckOutDate) {
    body.actualCheckOutDate = payload.actualCheckOutDate;
  }
  if (payload.cancelationReason != null) {
    body.cancelationReason = payload.cancelationReason.trim();
  }

  return body;
}

export function validateAddReservationDto(
  payload: AddReservationDtoPayload,
): { ok: true } | { ok: false; message: string } {
  if (!payload.requestId?.trim()) {
    return { ok: false, message: "معرّف الطلب (RequestId) مطلوب." };
  }
  if (!payload.startDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate)) {
    return { ok: false, message: "تاريخ البدء غير صالح." };
  }
  if (!payload.endDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(payload.endDate)) {
    return { ok: false, message: "تاريخ الانتهاء غير صالح." };
  }
  if (payload.endDate < payload.startDate) {
    return {
      ok: false,
      message: "تاريخ الانتهاء يجب أن يكون في أو بعد تاريخ البدء.",
    };
  }
  if (!Number.isFinite(payload.totalAmount) || payload.totalAmount < 0) {
    return { ok: false, message: "المبلغ الإجمالي يجب أن يكون صفراً أو أكبر." };
  }
  if (payload.status < 1 || payload.status > 5) {
    return { ok: false, message: "حالة الحجز غير صالحة." };
  }
  return { ok: true };
}

/**
 * UI preview only — mirrors backend `CalculateTotalAmountForRequest`:
 * sum(nightly unit prices) × nights. Prices are on Bed/Room/Apartment, not RequestUnit.
 */
export function computeReservationTotalAmountPreview(input: {
  nights: number;
  unitNightlyPrices: number[];
}): number {
  const nights = Math.max(1, Math.trunc(input.nights));
  const nightlySum = input.unitNightlyPrices.reduce((sum, price) => {
    if (!Number.isFinite(price) || price < 0) return sum;
    return sum + price;
  }, 0);
  return nightlySum * nights;
}

/** Resolves nightly price from a unit row (bed, room, or apartment API object). */
export function pickUnitNightlyPrice(raw: Record<string, unknown>): number {
  const price = raw.price ?? raw.Price;
  const n = Number(price);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Request `EndDate` from API, or `StartDate.AddDays(nights)` (matches backend `AddRequestDto` mapping).
 */
export function requestEndDateYmdFromRaw(
  raw: Record<string, unknown>,
  startDateYmd: string,
): string | null {
  const end = toYmd(raw.endDate ?? raw.EndDate);
  if (end) return end;

  const nights = extractNightsFromRequest(raw);
  if (nights <= 0) return null;

  const [y, m, d] = startDateYmd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + Math.ceil(nights));
  return date.toISOString().slice(0, 10);
}

/** Builds `AddReservationDto` from an approved housing `RequestDto` row. */
export function buildAddReservationDtoFromRequest(
  raw: Record<string, unknown>,
  requestId: string,
): AddReservationDtoPayload | null {
  const trimmedRequestId = requestId.trim();
  if (!trimmedRequestId) return null;

  const startDate = toYmd(raw.startDate ?? raw.StartDate);
  if (!startDate) return null;

  const endDate = requestEndDateYmdFromRaw(raw, startDate);
  if (!endDate || endDate < startDate) return null;

  return {
    requestId: trimmedRequestId,
    startDate,
    endDate,
    status: RESERVATION_STATUS_RESERVED,
    totalAmount: 0,
    cancelationReason: "",
  };
}

/** Unwraps `IFinalResult` / axios body into reservation rows. */
export function parseReservationsListFromApi(response: unknown): unknown[] {
  return getLookupArray(response);
}

/** True when reservations API returned success (not the axios error wrapper). */
export function isReservationApiSuccess(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const r = response as Record<string, unknown>;
  if ("error" in r && r.error) return false;

  const status = r.status ?? r.Status;
  if (status != null && status !== "") {
    const n = Number(status);
    if (Number.isFinite(n) && (n < 200 || n >= 300)) return false;
  }

  return true;
}

export function formatReservationStatusAr(status: ReservationStatus): string {
  switch (status) {
    case RESERVATION_STATUS_COMPLETED:
      return "تم اكتمال الإقامة";
    case RESERVATION_STATUS_CANCELED:
      return "ملغى";
    case RESERVATION_STATUS_NO_SHOW:
      return "لم يظهر";
    case RESERVATION_STATUS_CHECKOUT:
      return "تم تسجيل المغادرة";
    default:
      return "محجوز";
  }
}

/** Extension inquiry start date: same calendar day as reservation `endDate`. */
export function extensionStartDateAfterReservation(endDateYmd: string): string | null {
  const end = endDateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  return end;
}

/** Latest `Completed` reservation for the current user (by end date, then start date). */
export function pickLastCompletedReservation(
  items: unknown[],
): ReservationDtoPayload | null {
  const completed: ReservationDtoPayload[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const parsed = parseReservationFromApi(item as Record<string, unknown>);
    if (!parsed || parsed.isDeleted) continue;
    if (parsed.status !== RESERVATION_STATUS_COMPLETED) continue;
    completed.push(parsed);
  }

  completed.sort((a, b) => {
    const byEnd = b.endDate.localeCompare(a.endDate);
    if (byEnd !== 0) return byEnd;
    return b.startDate.localeCompare(a.startDate);
  });

  return completed[0] ?? null;
}

/** Computes inclusive end date from start (yyyy-MM-dd) and night count. */
export function reservationEndDateFromNights(
  startDateYmd: string,
  nights: number,
): string | null {
  const start = startDateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(nights) || nights <= 0) {
    return null;
  }
  const [y, m, d] = start.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + Math.ceil(nights) - 1);
  return date.toISOString().slice(0, 10);
}
