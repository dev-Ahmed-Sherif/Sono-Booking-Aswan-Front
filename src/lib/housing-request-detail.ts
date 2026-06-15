import { getLookupArray } from "@/lib/availability-inquiry";
import { mapCompanionDtoToFormEntry } from "@/lib/companion-registration";
import {
  HOUSING_REQUEST_CATAGORY_EXTENSION,
  HOUSING_REQUEST_CATAGORY_NEW_STAY,
  housingRequestStatusToApiName,
  normalizeRequestUnitsForAddRequestDto,
  parseAllocationTypeEnum,
  type AddRequestOldImagePayload,
  type AddRequestDtoPayload,
  type AddRequestParticipantDtoPayload,
  type AddRequestUnitDtoPayload,
  type HousingRequestCatagoryApi,
} from "@/lib/housing-request-map";
import {
  collectInquiryGendersFromUnits,
  normalizeUnitGender,
  parseInquiryGenders,
  resolvePersonGuestGender,
  type GuestGender,
} from "@/lib/reservation-guest-unit-validation";
import type { ReservationStoredUnitSnapshot } from "@/lib/availability-inquiry";
import {
  extractNightsFromRequest,
  extractRequestAllocationTypeValue,
  extractRequestTypeId,
  formatRequestAllocationTypeForTable,
  formatRequestCatagoryForTable,
  formatRequestTypeForTable,
  parseRequestCatagoryApiValue,
  toYmd,
} from "@/lib/housing-request-list";

export type ParseRequestDetailOptions = {
  requestTypeLabelsById?: Map<string, string>;
};

export type HousingRequestDetail = {
  id: string;
  requestNumber: string;
  startDate: string;
  nights: number;
  requestTypeId: string;
  requestAllocationType: 1 | 2;
  requestCatagory: HousingRequestCatagoryApi;
  statusLabel: string;
  /** Arabic labels aligned with «طلباتى السابقة» table columns. */
  requestClassificationLabel: string;
  requestTypeLabel: string;
  requestAllocationTypeLabel: string;
};

/** Saved attachment row from `RequestDto.RequestAttaches`. */
export type HousingRequestAttachmentSnapshot = {
  id: string;
  attachmentId: string;
  fileName: string;
  url: string;
  extension?: string;
};

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

const COMPANION_DISPLAY_NAME_KEYS = [
  "fullName",
  "FullName",
  "companionName",
  "CompanionName",
  "companionFullName",
  "CompanionFullName",
  "companionUserName",
  "CompanionUserName",
  "nameAr",
  "NameAr",
  "nameEn",
  "NameEn",
  "name",
  "Name",
  "userName",
  "UserName",
] as const;

function isUsableApiResponse(response: unknown): boolean {
  return Boolean(
    response && typeof response === "object" && !("error" in response),
  );
}

function setCompanionNameMapEntry(
  map: Map<string, string>,
  companionId: string,
  name: string,
) {
  const id = companionId.trim();
  const label = name.trim();
  if (!id || !label || isBlankDisplayName(label)) return;
  if (label.toLowerCase() === id.toLowerCase()) return;
  map.set(id, label);
  map.set(id.toLowerCase(), label);
  map.set(normalizeGuidLike(id), label);
}

/** Case-insensitive companion name lookup (GUID casing differences). */
export function lookupCompanionName(
  map: Map<string, string>,
  companionId: string,
): string {
  const id = companionId.trim();
  if (!id) return "";

  const direct =
    map.get(id) ??
    map.get(id.toLowerCase()) ??
    map.get(normalizeGuidLike(id));
  if (direct && !isBlankDisplayName(direct)) return direct.trim();

  const norm = normalizeGuidLike(id);
  for (const [key, value] of Array.from(map)) {
    if (normalizeGuidLike(key) === norm && !isBlankDisplayName(value)) {
      return value.trim();
    }
  }
  return "";
}

function companionNameFromRecord(r: Record<string, unknown>): string {
  return pickDisplayStr(r, ...COMPANION_DISPLAY_NAME_KEYS);
}

/** Same name resolution as registration / reservation companion picker. */
export function companionDisplayNameFromRecord(
  raw: Record<string, unknown>,
): string {
  const picked = companionNameFromRecord(raw);
  if (picked) return picked;
  const mapped = mapCompanionDtoToFormEntry(raw);
  return mapped.fullName?.trim() ?? "";
}

export function applyCompanionDisplayNameToMap(
  map: Map<string, string>,
  companionId: string,
  name: string,
): void {
  setCompanionNameMapEntry(map, companionId, name);
}

function normalizeGuidLike(value: string): string {
  return value.trim().toLowerCase().replace(/[{}]/g, "").replace(/-/g, "");
}

export function normalizeCompanionId(value: string): string {
  return normalizeGuidLike(value);
}

/** `RequestDto.UserId` — owner of the housing request (for companions lookup). */
export function extractRequestUserId(raw: Record<string, unknown>): string {
  return pickStr(raw, "userId", "UserId");
}

export function extractApiEntity(
  response: unknown,
): Record<string, unknown> | null {
  if (!response || typeof response !== "object") return null;
  if ("error" in response && (response as { error?: string }).error) {
    return null;
  }
  const r = response as Record<string, unknown>;
  const data = r.data ?? r.Data ?? r.result ?? r.Result;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function requestIdsMatch(
  rowRequestId: string,
  targetRequestId: string,
): boolean {
  if (!rowRequestId || !targetRequestId) return false;
  const a = rowRequestId.trim().toLowerCase();
  const b = targetRequestId.trim().toLowerCase();
  if (a === b) return true;
  return normalizeGuidLike(a) === normalizeGuidLike(b);
}

export function filterRowsByRequestId(
  items: unknown[],
  requestId: string,
): Record<string, unknown>[] {
  const key = requestId.trim();
  if (!key) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .filter((r) => {
      const rid = pickStr(r, "requestId", "RequestId");
      return requestIdsMatch(rid, key);
    });
}

/** `requestCompanions` / `requestParticipants` on `getRequestById` payload. */
export function extractEmbeddedParticipantsFromRequest(
  raw: Record<string, unknown>,
): Record<string, unknown>[] {
  const keys = [
    "requestCompanions",
    "RequestCompanions",
    "requestParticipants",
    "RequestParticipants",
    "participants",
    "Participants",
  ] as const;

  const out: Record<string, unknown>[] = [];
  for (const key of keys) {
    const val = raw[key];
    if (!Array.isArray(val)) continue;
    for (const item of val) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        out.push(item as Record<string, unknown>);
      }
    }
  }

  for (const key of ["companionIds", "CompanionIds"] as const) {
    const val = raw[key];
    if (!Array.isArray(val)) continue;
    for (const item of val) {
      const id = String(item ?? "").trim();
      if (id) out.push({ companionId: id });
    }
  }

  return out;
}

export function resolveParticipantRowsForRequest(
  requestRaw: Record<string, unknown>,
  participantsResponse: unknown,
  requestId: string,
  responseRoot?: unknown,
): Record<string, unknown>[] {
  const entityId = pickStr(requestRaw, "id", "Id");
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];

  const push = (row: Record<string, unknown>) => {
    const companionId = pickStr(row, "companionId", "CompanionId");
    const rowId = pickStr(row, "id", "Id");
    const dedupeKey = companionId || rowId;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push(row);
  };

  for (const row of extractEmbeddedParticipantsFromRequest(requestRaw)) {
    push(row);
  }

  if (responseRoot && typeof responseRoot === "object") {
    for (const row of extractEmbeddedParticipantsFromRequest(
      responseRoot as Record<string, unknown>,
    )) {
      push(row);
    }
  }

  const allItems = getLookupArray(participantsResponse);
  for (const id of [requestId, entityId]) {
    if (!id.trim()) continue;
    for (const row of filterRowsByRequestId(allItems, id)) {
      push(row);
    }
  }

  return rows;
}

export function extractCompanionIdsFromParticipantRows(
  rows: Record<string, unknown>[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const row of rows) {
    let companionId = pickStr(row, "companionId", "CompanionId");
    if (!companionId) {
      for (const navKey of ["companion", "Companion"] as const) {
        const nested = row[navKey];
        if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
          continue;
        }
        companionId = pickStr(nested as Record<string, unknown>, "id", "Id");
        if (companionId) break;
      }
    }
    if (companionId && !seen.has(companionId)) {
      seen.add(companionId);
      out.push(companionId);
    }
  }

  return out;
}

export function parseRequestUnitFromApi(
  raw: Record<string, unknown>,
): AddRequestUnitDtoPayload | null {
  const bedId = pickStr(raw, "bedId", "BedId");
  const roomId = pickStr(raw, "roomId", "RoomId");
  const apartmentId = pickStr(raw, "apartmentId", "ApartmentId");

  const meta: AddRequestUnitDtoPayload = {
    id: pickStr(raw, "id", "Id") || undefined,
    code: pickStr(raw, "code", "Code") || undefined,
    requestId: pickStr(raw, "requestId", "RequestId") || undefined,
  };

  if (bedId) return { ...meta, bedId };
  if (roomId) return { ...meta, roomId };
  if (apartmentId) return { ...meta, apartmentId };

  return null;
}

export function parseRequestDetail(
  raw: Record<string, unknown>,
  statusLabel: string,
  options?: ParseRequestDetailOptions,
): HousingRequestDetail | null {
  const id = pickStr(raw, "id", "Id");
  if (!id) return null;
  const startRaw = raw.startDate ?? raw.StartDate;
  const startDate = toYmd(startRaw) ?? "";
  const allocationValue = extractRequestAllocationTypeValue(raw);
  const requestAllocationType =
    parseAllocationTypeEnum(allocationValue) ?? 1;

  return {
    id,
    requestNumber: pickStr(raw, "requestNumber", "RequestNumber") || id,
    startDate,
    nights: extractNightsFromRequest(raw),
    requestTypeId: pickStr(raw, "requestTypeId", "RequestTypeId"),
    requestAllocationType,
    requestCatagory:
      parseRequestCatagoryApiValue(raw) ?? HOUSING_REQUEST_CATAGORY_NEW_STAY,
    statusLabel,
    requestClassificationLabel: formatRequestCatagoryForTable(raw),
    requestTypeLabel: formatRequestTypeForTable(
      raw,
      options?.requestTypeLabelsById,
    ),
    requestAllocationTypeLabel: formatRequestAllocationTypeForTable(raw),
  };
}

function attachmentDisplayName(
  fileName: string,
  url: string,
  extension?: string,
): string {
  const fromName = fileName.trim();
  if (fromName) return fromName;
  const fromUrl = url.split("/").pop()?.trim();
  if (fromUrl) return fromUrl;
  const ext = extension?.trim();
  return ext ? `attachment${ext.startsWith(".") ? ext : `.${ext}`}` : "مرفق";
}

/** Parses `RequestDto.requestAttaches` from `getRequestById` response entity. */
export function parseRequestAttachesFromApi(
  raw: Record<string, unknown>,
): HousingRequestAttachmentSnapshot[] {
  const collection = raw.requestAttaches ?? raw.RequestAttaches;
  if (!Array.isArray(collection)) return [];

  const out: HousingRequestAttachmentSnapshot[] = [];
  for (const item of collection) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const deleted = row.isDeleted ?? row.IsDeleted;
    if (deleted === true || deleted === "true" || deleted === 1) continue;

    const id = pickStr(row, "id", "Id");
    const attachmentId = pickStr(row, "attachmentId", "AttachmentId");
    const url = pickStr(row, "url", "Url");
    if (!id && !attachmentId && !url) continue;

    const extension = pickStr(row, "extension", "Extension") || undefined;
    const fileName = attachmentDisplayName(
      pickStr(row, "fileName", "FileName"),
      url,
      extension,
    );

    out.push({
      id: id || attachmentId,
      attachmentId: attachmentId || id,
      fileName,
      url,
      ...(extension ? { extension } : {}),
    });
  }

  return out;
}

/** @deprecated Prefer `formatStoredUnitLabel` when a snapshot is available. */
export function formatRequestUnitLabel(unit: AddRequestUnitDtoPayload): string {
  if (unit.bedId) return "سرير";
  if (unit.roomId) return "غرفة";
  return "شقة";
}

export function buildRequestOldImagesPayload(
  attachments: Pick<HousingRequestAttachmentSnapshot, "id">[],
): AddRequestOldImagePayload[] {
  return attachments
    .map((attachment) => ({
      id: attachment.id.trim(),
      isPrimary: false,
    }))
    .filter((img) => img.id.length > 0);
}

export function buildCancelRequestPayload(
  detail: HousingRequestDetail,
  requestUnits: AddRequestUnitDtoPayload[],
  companionIds: string[],
): AddRequestDtoPayload & { status: string } {
  const base = buildUpdateRequestPayload(detail, requestUnits, companionIds);
  return {
    ...base,
    status: housingRequestStatusToApiName(
      HOUSING_REQUEST_STATUS_ENUM.Canceled,
    ),
    ...(base.requestCatagory === HOUSING_REQUEST_CATAGORY_EXTENSION
      ? { previousRequestId: null }
      : {}),
  };
}

export function buildUpdateRequestPayload(
  detail: HousingRequestDetail,
  requestUnits: AddRequestUnitDtoPayload[],
  companionIds: string[],
): AddRequestDtoPayload {
  const requestCompanions: AddRequestParticipantDtoPayload[] = companionIds
    .map((companionId) => ({ companionId: companionId.trim() }))
    .filter((p) => p.companionId.length > 0);

  return {
    id: detail.id,
    startDate: detail.startDate,
    nights: detail.nights,
    requestTypeId: detail.requestTypeId,
    requestAllocationType: detail.requestAllocationType,
    requestCatagory: detail.requestCatagory,
    requestUnits: normalizeRequestUnitsForAddRequestDto(
      requestUnits,
      detail.id,
    ),
    requestCompanions,
  };
}

export type LeaderRequestDecision = "approve" | "reject";

/** `SonoBooking.Domain.Status` values used on `RequestDto.Status`. */
export const HOUSING_REQUEST_STATUS_ENUM = {
  Approved: 1,
  Rejected: 2,
  Pending: 3,
  Canceled: 4,
} as const;

/** Leader approve/reject update — sets `Status`, `ApprovedById`, `ApprovedAt`, `RejectionReason`. */
export function buildLeaderRequestDecisionPayload(
  raw: Record<string, unknown>,
  requestUnits: AddRequestUnitDtoPayload[],
  companionIds: string[],
  decision: LeaderRequestDecision,
  options: { leaderUserId: string; rejectionReason?: string },
): AddRequestDtoPayload & { status: number | string } {
  const statusNumeric =
    decision === "approve"
      ? HOUSING_REQUEST_STATUS_ENUM.Approved
      : HOUSING_REQUEST_STATUS_ENUM.Rejected;
  const status = housingRequestStatusToApiName(statusNumeric);
  const approvedAt = new Date().toISOString();
  const startDate = toYmd(raw.startDate ?? raw.StartDate) ?? "";
  const allocationValue = extractRequestAllocationTypeValue(raw);
  const requestCompanions: AddRequestParticipantDtoPayload[] = companionIds
    .map((companionId) => ({ companionId: companionId.trim() }))
    .filter((p) => p.companionId.length > 0);

  const rejectionReason =
    decision === "reject" ? String(options.rejectionReason ?? "").trim() : "";

  const requestId = pickStr(raw, "id", "Id");

  return {
    id: requestId,
    requestNumber:
      pickStr(raw, "requestNumber", "RequestNumber") || undefined,
    startDate,
    nights: Math.max(1, extractNightsFromRequest(raw)),
    requestTypeId: extractRequestTypeId(raw),
    requestAllocationType: parseAllocationTypeEnum(allocationValue) ?? 1,
    requestCatagory:
      parseRequestCatagoryApiValue(raw) ?? HOUSING_REQUEST_CATAGORY_NEW_STAY,
    requestUnits: normalizeRequestUnitsForAddRequestDto(
      requestUnits,
      requestId,
    ),
    requestCompanions,
    rejectionReason,
    approvedById: options.leaderUserId.trim(),
    approvedAt,
    status,
  };
}

export function buildCompanionGenderMap(
  companionsResponse: unknown,
): Map<string, GuestGender> {
  const map = new Map<string, GuestGender>();
  for (const item of getLookupArray(companionsResponse)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    if (!id) continue;
    const gender = resolvePersonGuestGender(r);
    if (gender) map.set(id, gender);
  }
  return map;
}

export type InquiryGenderAvailabilityContext = {
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
};

/** Distinct genders from request participant rows (applicant + companions). */
export function collectInquiryGendersFromParticipants(
  participants: Record<string, unknown>[],
): GuestGender[] {
  const out: GuestGender[] = [];
  for (const row of participants) {
    const gender = resolvePersonGuestGender(row);
    if (gender && !out.includes(gender)) out.push(gender);
  }
  return out;
}

/** Inquiry genders from request row, or inferred from saved units when absent. */
export function resolveInquiryGendersForRequest(
  requestRaw: Record<string, unknown> | undefined,
  units: ReservationStoredUnitSnapshot[],
  availability?: InquiryGenderAvailabilityContext,
  participants?: Record<string, unknown>[],
): GuestGender[] {
  const fromRequest = parseInquiryGenders(requestRaw);
  if (fromRequest.length > 0) return fromRequest;

  if (availability && units.length > 0) {
    const fromUnits = collectInquiryGendersFromUnits(
      units,
      availability.bedsRaw,
      availability.roomsRaw,
      availability.apartmentsRaw,
    );
    if (fromUnits.length > 0) return fromUnits;
  }

  if (participants?.length) {
    const fromParticipants = collectInquiryGendersFromParticipants(participants);
    if (fromParticipants.length > 0) return fromParticipants;
  }

  const out: GuestGender[] = [];
  for (const unit of units) {
    const g = normalizeUnitGender(unit.genderType);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

/** Names from `RequestParticipants` rows (flat or nested `companion`). */
export function buildCompanionNameMapFromParticipants(
  participants: Record<string, unknown>[],
): Map<string, string> {
  const map = new Map<string, string>();

  const add = (companionId: string, name: string) => {
    setCompanionNameMapEntry(map, companionId, name);
  };

  for (const row of participants) {
    const companionId = pickStr(row, "companionId", "CompanionId");
    const flatName = companionDisplayNameFromRecord(row);
    if (companionId && flatName) {
      add(companionId, flatName);
      continue;
    }

    for (const navKey of ["companion", "Companion"] as const) {
      const nested = row[navKey];
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
        continue;
      }
      const n = nested as Record<string, unknown>;
      const id = pickStr(n, "id", "Id") || companionId;
      const name = companionDisplayNameFromRecord(n);
      if (id && name) add(id, name);
    }
  }

  return map;
}

export function buildCompanionNameMap(
  companionsResponse: unknown,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of getLookupArray(companionsResponse)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    if (!id) continue;
    const name = companionDisplayNameFromRecord(r);
    if (name) setCompanionNameMapEntry(map, id, name);
  }
  return map;
}

/**
 * Display map keyed by participant `companionId` (same keys as `companionIds` state).
 * Merges participants + owner's companions list (+ optional fallback list for leaders).
 */
export function buildCompanionDisplayMapForIds(
  participantRows: Record<string, unknown>[],
  companionIds: string[],
  primaryCompanionsResponse: unknown,
  fallbackCompanionsResponse?: unknown,
): Map<string, string> {
  const merged = mergeCompanionNameMaps(
    buildCompanionNameMapFromParticipants(participantRows),
    isUsableApiResponse(primaryCompanionsResponse)
      ? buildCompanionNameMap(primaryCompanionsResponse)
      : new Map(),
    isUsableApiResponse(fallbackCompanionsResponse)
      ? buildCompanionNameMap(fallbackCompanionsResponse)
      : new Map(),
  );

  const display = new Map<string, string>();
  for (const id of companionIds) {
    const name = lookupCompanionName(merged, id);
    if (name) display.set(id.trim(), name);
  }
  return display;
}

/** Prefer real names over id placeholders when merging lookup maps. */
export function mergeCompanionNameMaps(
  ...maps: Map<string, string>[]
): Map<string, string> {
  const out = new Map<string, string>();
  const isIdPlaceholder = (id: string, label: string) =>
    label.trim().toLowerCase() === id.trim().toLowerCase();

  for (const source of maps) {
    for (const [id, label] of Array.from(source)) {
      if (isIdPlaceholder(id, label)) continue;
      const existing = lookupCompanionName(out, id);
      if (!existing) {
        setCompanionNameMapEntry(out, id, label);
        continue;
      }
      if (isIdPlaceholder(id, existing)) {
        setCompanionNameMapEntry(out, id, label);
      }
    }
  }
  return out;
}
