import { getLookupArray } from "@/lib/availability-inquiry";

/** Shown in «طلباتى السابقة» for housing requests. */
export const NEW_STAY_REQUEST_TYPE_LABEL = "طلب إقامة جديد";

/** Shown in «طلباتى السابقة» for extension rows. */
export const EXTENSION_STAY_REQUEST_TYPE_LABEL = "طلب تمديد";

export type HousingHistoryEntryKind = "request" | "extension";

export type HousingRequestTableRow = {
  id: string;
  entryKind: HousingHistoryEntryKind;
  requestNo: string;
  /** «طلب إقامة جديد» or «طلب تمديد». */
  requestClassification: string;
  /** Arabic label from API `RequestType`. */
  requestType: string;
  /** Arabic label from API `RequestAllocationType` (ثابت / مرن). */
  requestAllocationType: string;
  startDate: string;
  nights: number;
  status: string;
  /** `yyyy-MM-dd` used to sort merged requests + extensions (newest first). */
  sortDate: string;
};

export type MapRequestsToTableRowsOptions = {
  userId?: string;
  /** Resolve `requestTypeId` when the list API returns only an id. */
  requestTypeLabelsById?: Map<string, string>;
  /** Omit rows where `isDeleted` / `IsDeleted` is true (guest history lists). */
  excludeDeleted?: boolean;
};

export function isHousingRequestRecordDeleted(
  raw: Record<string, unknown>,
): boolean {
  const value = raw.isDeleted ?? raw.IsDeleted;
  if (value === true) return true;
  if (typeof value === "string" && value.trim().toLowerCase() === "true") {
    return true;
  }
  return value === 1 || value === "1";
}

/** Reads `RequestAllocationType` from a request DTO (scalar, enum, or nested lookup). */
export function extractRequestAllocationTypeValue(
  raw: Record<string, unknown>,
): unknown {
  const candidates = [
    raw.RequestAllocationType,
    raw.requestAllocationType,
    raw.RequestAllocationTypeId,
    raw.requestAllocationTypeId,
    raw.RequestAllocationTypeName,
    raw.requestAllocationTypeName,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const label = pickStr(
        nested,
        "nameAr",
        "NameAr",
        "nameEn",
        "NameEn",
        "label",
        "Label",
        "name",
        "Name",
        "title",
        "Title",
      );
      if (label) return label;
      const inner = nested.value ?? nested.Value ?? nested.id ?? nested.Id;
      if (inner != null) return inner;
      continue;
    }
    return candidate;
  }

  return undefined;
}

export function formatRequestAllocationTypeForTable(
  raw: Record<string, unknown>,
): string {
  const value = extractRequestAllocationTypeValue(raw);
  if (value == null) return "—";

  const text = String(value).trim();
  if (!text) return "—";
  if (text === "ثابت" || text === "مرن" || text === "متحرك") {
    return text === "متحرك" ? "مرن" : text;
  }

  return formatAllocationTypeAr(value);
}

/** Reads `RequestType` from a request DTO (scalar, nested lookup, or label fields). */
export function extractRequestTypeValue(
  raw: Record<string, unknown>,
): unknown {
  const candidates = [
    raw.RequestType,
    raw.requestType,
    raw.RequestTypeName,
    raw.requestTypeName,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const label = pickStr(
        nested,
        "nameAr",
        "NameAr",
        "nameEn",
        "NameEn",
        "label",
        "Label",
        "name",
        "Name",
        "title",
        "Title",
      );
      if (label) return label;
      const inner = nested.value ?? nested.Value ?? nested.id ?? nested.Id;
      if (inner != null) return inner;
      continue;
    }
    return candidate;
  }

  const label = pickStr(
    raw,
    "requestTypeLabel",
    "RequestTypeLabel",
    "requestTypeName",
    "RequestTypeName",
  );
  return label || undefined;
}

/** Resolves `requestTypeId` from flat fields or nested `RequestType` lookup. */
export function extractRequestTypeId(raw: Record<string, unknown>): string {
  const nested = raw.RequestType ?? raw.requestType;
  if (nested != null && typeof nested === "object") {
    const id = pickStr(nested as Record<string, unknown>, "id", "Id");
    if (id) return id;
  }
  return pickStr(raw, "requestTypeId", "RequestTypeId");
}

export function formatRequestTypeForTable(
  raw: Record<string, unknown>,
  requestTypeLabelsById?: Map<string, string>,
): string {
  const value = extractRequestTypeValue(raw);
  if (value != null) {
    const text = String(value).trim();
    if (text) return text;
  }

  const typeId = pickStr(raw, "requestTypeId", "RequestTypeId");
  if (typeId && requestTypeLabelsById?.size) {
    const resolved = requestTypeLabelsById.get(typeId);
    if (resolved?.trim()) return resolved.trim();
  }

  return "—";
}

/** Reads `RequestCatagory` from a request DTO (backend spelling). */
export function extractRequestCatagoryValue(
  raw: Record<string, unknown>,
): unknown {
  const candidates = [
    raw.RequestCatagory,
    raw.requestCatagory,
    raw.RequestCategory,
    raw.requestCategory,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const label = pickStr(
        nested,
        "nameAr",
        "NameAr",
        "nameEn",
        "NameEn",
        "value",
        "Value",
        "name",
        "Name",
      );
      if (label) return label;
      const inner = nested.value ?? nested.Value ?? nested.id ?? nested.Id;
      if (inner != null) return inner;
      continue;
    }
    return candidate;
  }

  return undefined;
}

export function parseRequestCatagoryApiValue(
  raw: Record<string, unknown>,
): "NewStay" | "Extension" | undefined {
  const value = extractRequestCatagoryValue(raw);
  if (value == null) return undefined;

  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (Number.isFinite(n)) {
    if (n === 1) return "NewStay";
    if (n === 2) return "Extension";
  }

  const normalized = String(value).trim().toLowerCase().replace(/[_\s-]/g, "");
  if (normalized === "newstay") return "NewStay";
  if (normalized === "extension" || normalized === "extensionstay") {
    return "Extension";
  }

  return undefined;
}

/** Maps `RequestCatagory` to Arabic «تصنيف الطلب» for tables and detail modals. */
export function formatRequestCatagoryForTable(
  raw: Record<string, unknown>,
  fallback: string = NEW_STAY_REQUEST_TYPE_LABEL,
): string {
  const parsed = parseRequestCatagoryApiValue(raw);
  if (parsed === "NewStay") return NEW_STAY_REQUEST_TYPE_LABEL;
  if (parsed === "Extension") return EXTENSION_STAY_REQUEST_TYPE_LABEL;

  const text = String(extractRequestCatagoryValue(raw) ?? "").trim();
  if (!text) return fallback;
  if (
    text === NEW_STAY_REQUEST_TYPE_LABEL ||
    text === EXTENSION_STAY_REQUEST_TYPE_LABEL
  ) {
    return text;
  }

  return text;
}

export function formatAllocationTypeAr(value: unknown): string {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim());
  if (n === 1) return "ثابت";
  if (n === 2) return "مرن";
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s.includes("fixed") || s === "ثابت" || s === "1") return "ثابت";
  if (
    s.includes("flex") ||
    s.includes("movable") ||
    s === "مرن" ||
    s === "متحرك" ||
    s === "2"
  ) {
    return "مرن";
  }
  return "—";
}

export function isHousingRequestStatusLocked(statusLabel: string): boolean {
  return (
    statusLabel === "تمت الموافقة" ||
    statusLabel === "مرفوض" ||
    statusLabel === "ملغى"
  );
}

export function isHousingRequestApproved(statusLabel: string): boolean {
  return statusLabel === "تمت الموافقة";
}

/** Guest may edit unless approved or already canceled. */
export function canEditHousingRequest(statusLabel: string): boolean {
  return !isHousingRequestApproved(statusLabel) && statusLabel !== "ملغى";
}

/** Guest may cancel while the request is still under review. */
export function canCancelHousingRequest(statusLabel: string): boolean {
  return statusLabel === "قيد المراجعة";
}

/** Reads linked reservation id from a request DTO (extension requests). */
export function extractReservationIdFromRequest(
  raw: Record<string, unknown>,
): string {
  return pickStr(raw, "reservationId", "ReservationId");
}

/** Arabic status line shown after an extension request is submitted. */
export function getHousingRequestStatusPreviewMessage(
  statusLabel: string,
): string {
  switch (statusLabel) {
    case "قيد المراجعة":
      return "طلب التمديد قيد المراجعة من قبل الإدارة.";
    case "تمت الموافقة":
      return "تمت الموافقة على طلب التمديد.";
    case "مرفوض":
      return "تم رفض طلب التمديد.";
    case "ملغى":
      return "تم إلغاء طلب التمديد.";
    default:
      return "تم تقديم طلب التمديد.";
  }
}

/** Whether the guest may submit another extension after a prior request. */
export function canSubmitNewExtensionRequest(statusLabel: string): boolean {
  return statusLabel === "مرفوض" || statusLabel === "ملغى";
}

/** Latest extension request linked to a completed reservation, if any. */
export function findLatestExtensionRequestForReservation(
  items: unknown[],
  reservationId: string,
  options?: MapRequestsToTableRowsOptions,
): HousingRequestTableRow | null {
  const reservationKey = reservationId.trim().toLowerCase();
  if (!reservationKey) return null;

  const candidates: HousingRequestTableRow[] = [];

  for (const r of filterItemsByUserId(items, options?.userId)) {
    if (options?.excludeDeleted && isHousingRequestRecordDeleted(r)) continue;
    if (parseRequestCatagoryApiValue(r) !== "Extension") continue;
    const rowReservationId = extractReservationIdFromRequest(r).toLowerCase();
    if (!rowReservationId || rowReservationId !== reservationKey) continue;
    const row = mapApiRequestToTableRow(r, {
      requestTypeLabelsById: options?.requestTypeLabelsById,
    });
    if (row) candidates.push(row);
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.sortDate.localeCompare(a.sortDate))[0]!;
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function isBlankDisplayName(value: string): boolean {
  const t = value.trim().toLowerCase();
  return !t || t === "null" || t === "undefined";
}

function pickDisplayStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v == null || typeof v === "object") continue;
    const s = String(v).trim();
    if (!isBlankDisplayName(s)) return s;
  }
  return "";
}

/** Applicant name from `RequestDto.UserName` (camelCase `userName` in JSON). */
export function extractApplicantDisplayNameFromRequest(
  raw: Record<string, unknown>,
): string {
  const name = pickDisplayStr(
    raw,
    "userName",
    "UserName",
    "createdBy",
    "CreatedBy",
  );
  return name || "—";
}

export function toYmd(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Nights = difference between start and end dates (matches backend `EndDate = StartDate + Nights`). */
export function countNightsBetweenStartAndEnd(
  start: unknown,
  end: unknown,
): number {
  const startYmd = toYmd(start);
  const endYmd = toYmd(end);
  if (!startYmd || !endYmd) return 0;
  const s = new Date(`${startYmd}T12:00:00`);
  const e = new Date(`${endYmd}T12:00:00`);
  const diff = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/** Prefer explicit `Nights` on the DTO; otherwise derive from start/end (same as the history table). */
export function extractNightsFromRequest(raw: Record<string, unknown>): number {
  const explicit =
    raw.nights ??
    raw.Nights ??
    raw.numberOfNights ??
    raw.NumberOfNights;
  if (explicit != null && String(explicit).trim() !== "") {
    const n = Number(String(explicit).trim());
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  const startRaw = raw.startDate ?? raw.StartDate;
  const endRaw = raw.endDate ?? raw.EndDate;
  return countNightsBetweenStartAndEnd(startRaw, endRaw);
}

/** Maps `SonoBooking.Domain.Status` to Arabic labels for the table. */
export function formatHousingRequestStatusAr(status: unknown): string {
  if (status == null) return "—";
  const n = typeof status === "number" ? status : Number(String(status).trim());
  if (Number.isFinite(n)) {
    switch (n) {
      case 1:
        return "تمت الموافقة";
      case 2:
        return "مرفوض";
      case 3:
        return "قيد المراجعة";
      case 4:
        return "ملغى";
      default:
        break;
    }
  }
  const t = String(status).trim().toLowerCase();
  if (t.includes("approv") || t === "مقبول") return "تمت الموافقة";
  if (t.includes("reject") || t === "مرفوض") return "مرفوض";
  if (t.includes("cancel") || t === "ملغى") return "ملغى";
  if (t.includes("pending") || t.includes("complet") || t === "معلق") {
    return "قيد المراجعة";
  }
  return String(status);
}

export function mapApiRequestToTableRow(
  raw: Record<string, unknown>,
  options?: Pick<MapRequestsToTableRowsOptions, "requestTypeLabelsById">,
): HousingRequestTableRow | null {
  const id = pickStr(raw, "id", "Id");
  const requestNo =
    pickStr(raw, "requestNumber", "RequestNumber") || id;
  const startRaw = raw.startDate ?? raw.StartDate;
  const startDate = toYmd(startRaw) ?? "—";
  const nights = extractNightsFromRequest(raw);

  if (!id && !requestNo) return null;

  const sortDate = startDate === "—" ? "" : startDate;

  return {
    id: id || requestNo,
    entryKind: "request",
    requestNo,
    requestClassification: formatRequestCatagoryForTable(raw),
    requestType: formatRequestTypeForTable(
      raw,
      options?.requestTypeLabelsById,
    ),
    requestAllocationType: formatRequestAllocationTypeForTable(raw),
    startDate,
    nights,
    status: formatHousingRequestStatusAr(raw.status ?? raw.Status),
    sortDate,
  };
}

export function mapApiExtensionToTableRow(
  raw: Record<string, unknown>,
  options?: Pick<MapRequestsToTableRowsOptions, "requestTypeLabelsById">,
): HousingRequestTableRow | null {
  const id = pickStr(raw, "id", "Id");
  const requestNo =
    pickStr(
      raw,
      "extensionNumber",
      "ExtensionNumber",
      "requestNumber",
      "RequestNumber",
      "number",
      "Number",
    ) || id;
  const startRaw =
    raw.startDate ??
    raw.StartDate ??
    raw.newStartDate ??
    raw.NewStartDate ??
    raw.extensionStartDate ??
    raw.ExtensionStartDate;
  const startDate = toYmd(startRaw) ?? "—";
  const nights = extractNightsFromRequest(raw);
  const sortDate = startDate === "—" ? "" : startDate;

  if (!id && !requestNo) return null;

  return {
    id: id ? `ext:${id}` : `ext:${requestNo}`,
    entryKind: "extension",
    requestNo,
    requestClassification: formatRequestCatagoryForTable(
      raw,
      EXTENSION_STAY_REQUEST_TYPE_LABEL,
    ),
    requestType: formatRequestTypeForTable(
      raw,
      options?.requestTypeLabelsById,
    ),
    requestAllocationType: formatRequestAllocationTypeForTable(raw),
    startDate,
    nights,
    status: formatHousingRequestStatusAr(raw.status ?? raw.Status),
    sortDate,
  };
}

export function parseRequestsListFromApi(response: unknown): unknown[] {
  return getLookupArray(response);
}

export const parseExtensionsListFromApi = parseRequestsListFromApi;

function filterItemsByUserId(
  items: unknown[],
  userId?: string,
): Record<string, unknown>[] {
  const userKey = userId?.trim().toLowerCase();
  const out: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (userKey) {
      const rowUser = pickStr(r, "userId", "UserId").toLowerCase();
      if (rowUser && rowUser !== userKey) continue;
    }
    out.push(r);
  }
  return out;
}

export function mapRequestsToTableRows(
  items: unknown[],
  options?: MapRequestsToTableRowsOptions,
): HousingRequestTableRow[] {
  const rows: HousingRequestTableRow[] = [];

  for (const r of filterItemsByUserId(items, options?.userId)) {
    if (options?.excludeDeleted && isHousingRequestRecordDeleted(r)) continue;
    const row = mapApiRequestToTableRow(r, {
      requestTypeLabelsById: options?.requestTypeLabelsById,
    });
    if (row) rows.push(row);
  }

  return rows;
}

export function mapExtensionsToTableRows(
  items: unknown[],
  options?: MapRequestsToTableRowsOptions,
): HousingRequestTableRow[] {
  const rows: HousingRequestTableRow[] = [];

  for (const r of filterItemsByUserId(items, options?.userId)) {
    if (options?.excludeDeleted && isHousingRequestRecordDeleted(r)) continue;
    const row = mapApiExtensionToTableRow(r, {
      requestTypeLabelsById: options?.requestTypeLabelsById,
    });
    if (row) rows.push(row);
  }

  return rows;
}

/** Merges housing requests and extensions, sorted by start date (newest first). */
export function mergeAndSortHistoryTableRows(
  requests: HousingRequestTableRow[],
  extensions: HousingRequestTableRow[],
): HousingRequestTableRow[] {
  return [...requests, ...extensions].sort((a, b) =>
    b.sortDate.localeCompare(a.sortDate),
  );
}
