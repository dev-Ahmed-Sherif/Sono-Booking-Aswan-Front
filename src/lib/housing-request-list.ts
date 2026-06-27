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
  if (normalized === "newstay" || normalized === "طلبإقامةجديد") {
    return "NewStay";
  }
  if (
    normalized === "extension" ||
    normalized === "extensionstay" ||
    normalized === "طلبتمديد"
  ) {
    return "Extension";
  }

  return undefined;
}

/** True when API row represents an extension request (`RequestCatagory.Extension`). */
export function isExtensionRequestRecord(
  raw: Record<string, unknown>,
): boolean {
  if (parseRequestCatagoryApiValue(raw) === "Extension") return true;
  return formatRequestCatagoryForTable(raw) === EXTENSION_STAY_REQUEST_TYPE_LABEL;
}

/** Latest extension request for the user (any reservation), newest first. */
export function findLatestExtensionRequest(
  items: unknown[],
  options?: MapRequestsToTableRowsOptions,
): { row: HousingRequestTableRow; reservationId: string } | null {
  const candidates: Array<{
    row: HousingRequestTableRow;
    reservationId: string;
  }> = [];

  for (const r of filterItemsByUserId(items, options?.userId)) {
    if (options?.excludeDeleted && isHousingRequestRecordDeleted(r)) continue;
    if (!isExtensionRequestRecord(r)) continue;
    const row = mapApiRequestToTableRow(r, {
      requestTypeLabelsById: options?.requestTypeLabelsById,
    });
    if (!row) continue;
    candidates.push({
      row,
      reservationId: extractReservationIdFromRequest(r),
    });
  }

  if (candidates.length === 0) return null;
  const sorted = candidates.sort((a, b) =>
    b.row.sortDate.localeCompare(a.row.sortDate),
  );
  return sorted[0] ?? null;
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

/** True when request type is مأمورية / mission (attachments required on new requests). */
export function isMissionRequestType(
  label?: string | null,
  labelEn?: string | null,
): boolean {
  const ar = String(label ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const en = String(labelEn ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (ar.includes("مأمورية") || ar.includes("مامورية")) return true;
  if (en === "mission" || en.includes("mission")) return true;
  return false;
}

export function isHousingRequestStatusLocked(statusLabel: string): boolean {
  return (
    statusLabel === "تمت الموافقة" ||
    statusLabel === "مرفوض" ||
    statusLabel === "ملغى"
  );
}

export function isHousingRequestApproved(statusLabel: string): boolean {
  const normalized = statusLabel.trim();
  if (normalized === "تمت الموافقة") return true;
  const lower = normalized.toLowerCase();
  return (
    lower.includes("approv") || lower === "مقبول" || lower === "approved"
  );
}

/** Guest may edit only while the request is under review. */
export function canEditHousingRequest(statusLabel: string): boolean {
  return statusLabel === "قيد المراجعة";
}

/** Leader may adjust units on a pending flexible request that overlaps an approved stay. */
export function canLeaderEditHousingRequestUnits(input: {
  statusLabel: string;
  allocationLabel: string;
  hasApprovedUnitOverlap?: boolean;
}): boolean {
  if (input.statusLabel !== "قيد المراجعة") return false;
  const allocation = input.allocationLabel.trim();
  const isFlexible =
    allocation === "مرن" ||
    allocation === "متحرك" ||
    allocation.toLowerCase().includes("flex");
  if (!isFlexible) return false;
  return input.hasApprovedUnitOverlap === true;
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
    if (!isExtensionRequestRecord(r)) continue;
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
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const y = o.year ?? o.Year;
    const m = o.month ?? o.Month;
    const d = o.day ?? o.Day;
    if (y != null && m != null && d != null) {
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day)
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
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

/** Matches backend `EndDate = StartDate.AddDays(Nights)`. */
export function addDaysToYmd(startYmd: string, days: number): string {
  const d = new Date(`${startYmd.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + Math.max(0, Math.trunc(days)));
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

/** Maps `SonoBooking.Domain.Status` to a normalized bucket. */
export type NormalizedHousingRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "canceled"
  | "unknown";

/** Backend `Status`: Pending=1, Approved=2, Rejected=3, Canceled=4. */
export function normalizeHousingRequestStatus(
  value: unknown,
): NormalizedHousingRequestStatus {
  if (value == null) return "unknown";

  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (Number.isFinite(n)) {
    switch (n) {
      case 1:
        return "pending";
      case 2:
        return "approved";
      case 3:
        return "rejected";
      case 4:
        return "canceled";
      default:
        break;
    }
  }

  const t = String(value).trim().toLowerCase();
  if (!t) return "unknown";
  if (
    t.includes("pending") ||
    t.includes("complet") ||
    t === "معلق" ||
    t === "قيد المراجعة"
  ) {
    return "pending";
  }
  if (
    t.includes("approv") ||
    t === "مقبول" ||
    t === "تمت الموافقة"
  ) {
    return "approved";
  }
  if (t.includes("reject") || t === "مرفوض") return "rejected";
  if (t.includes("cancel") || t === "ملغى" || t === "ملغي") return "canceled";
  return "unknown";
}

export function isRequestStatusPending(value: unknown): boolean {
  return normalizeHousingRequestStatus(value) === "pending";
}

export function isRequestStatusApproved(value: unknown): boolean {
  return normalizeHousingRequestStatus(value) === "approved";
}

/** Maps `SonoBooking.Domain.Status` to Arabic labels for the table. */
export function formatHousingRequestStatusAr(status: unknown): string {
  if (status == null) return "—";
  switch (normalizeHousingRequestStatus(status)) {
    case "approved":
      return "تمت الموافقة";
    case "rejected":
      return "مرفوض";
    case "canceled":
      return "ملغى";
    case "pending":
      return "قيد المراجعة";
    default:
      return String(status);
  }
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

/** Compare request numbers (`REQ-2026-0001`, etc.) for stable table ordering. */
export function compareHousingRequestNumbers(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** Merges housing requests and extensions, sorted by request number (highest first). */
export function mergeAndSortHistoryTableRows(
  requests: HousingRequestTableRow[],
  extensions: HousingRequestTableRow[],
): HousingRequestTableRow[] {
  return [...requests, ...extensions].sort(
    (a, b) => compareHousingRequestNumbers(b.requestNo, a.requestNo),
  );
}
