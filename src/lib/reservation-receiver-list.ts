import { formatStoredUnitLabel, getLookupArray } from "@/lib/availability-inquiry";
import { parseBirthDateValue } from "@/lib/companion-registration";
import { extractApplicantDisplayNameFromRequest } from "@/lib/housing-request-list";
import {
  buildCompanionNameMapFromParticipants,
  extractCompanionIdsFromParticipantRows,
  filterRowsByRequestId,
  parseRequestUnitFromApi,
  resolveParticipantRowsForRequest,
} from "@/lib/housing-request-detail";
import {
  enrichRequestUnitRowsFromHierarchy,
  parseRequestServiceError,
  requestUnitDtosToEnrichedSnapshots,
} from "@/lib/housing-request-map";
import {
  isReservationApiSuccess,
  parseReservationFromApi,
  parseReservationsListFromApi,
  RESERVATION_STATUS_COMPLETED,
  RESERVATION_STATUS_RESERVED,
  type ReservationDtoPayload,
  type ReservationStatus,
} from "@/lib/reservation-map";

export type ReceiverReservationRow = {
  id: string;
  requestId: string;
  userName: string;
  room: string;
  reservationUnits: string[];
  companions: Array<{ name: string; relationship: string; age?: number }>;
  /** Formatted for table display. */
  arrivalDate: string;
  totalAmount: number;
  checkInAt?: string;
  actualCheckOutAt?: string;
  cancelationReason?: string;
  startDateYmd: string;
  endDateYmd: string;
  status: ReservationStatus;
};

export type ReceiverCompanionMeta = {
  name?: string;
  relationshipId?: string;
  relationshipName?: string;
  age?: number;
};

function pickLabelFromRecord(row: Record<string, unknown>): string {
  return String(
    row.nameAr ??
      row.NameAr ??
      row.name ??
      row.Name ??
      row.nameEn ??
      row.NameEn ??
      "",
  ).trim();
}

function pickCompanionRelationshipName(
  item: Record<string, unknown>,
  relationshipLabelById?: Map<string, string>,
): string {
  for (const navKey of ["relationship", "Relationship"] as const) {
    const nested = item[navKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const label = pickLabelFromRecord(nested as Record<string, unknown>);
    if (label) return label;
  }

  const relationshipId = String(
    item.relationshipId ?? item.RelationshipId ?? "",
  ).trim();
  if (relationshipId && relationshipLabelById) {
    return (
      relationshipLabelById.get(relationshipId) ??
      relationshipLabelById.get(relationshipId.toLowerCase()) ??
      ""
    );
  }

  return "";
}

function computeAgeFromBirthDate(birthDate: Date): number | undefined {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : undefined;
}

function pickCompanionAge(item: Record<string, unknown>): number | undefined {
  const directAge = Number(item.age ?? item.Age);
  if (Number.isFinite(directAge) && directAge >= 0 && directAge < 150) {
    return Math.trunc(directAge);
  }

  const birthDate = parseBirthDateValue(item.birthDate ?? item.BirthDate);
  if (!birthDate) return undefined;
  return computeAgeFromBirthDate(birthDate);
}

/** Parses companion API row for receiver list enrichment. */
export function parseCompanionMetaFromApi(
  item: Record<string, unknown>,
  relationshipLabelById?: Map<string, string>,
): ReceiverCompanionMeta {
  const id = String(item.id ?? item.Id ?? "").trim();
  if (!id) return {};

  const name = String(item.fullName ?? item.FullName ?? "").trim() || undefined;
  const relationshipId =
    String(item.relationshipId ?? item.RelationshipId ?? "").trim() || undefined;
  const relationshipName =
    pickCompanionRelationshipName(item, relationshipLabelById) || undefined;
  const age = pickCompanionAge(item);

  return { name, relationshipId, relationshipName, age };
}

export function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatReceiverDisplayDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("ar-EG");
}

export function formatReceiverDisplayDateTime(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ar-EG");
}

function indexRequestsById(
  requestsRes: unknown,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of getLookupArray(requestsRes)) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = String(raw.id ?? raw.Id ?? "").trim();
    if (id) map.set(id.toLowerCase(), raw);
  }
  return map;
}

function unitLabelsForRequest(
  requestId: string,
  requestUnitsRes: unknown,
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): string[] {
  const rows = enrichRequestUnitRowsFromHierarchy(
    filterRowsByRequestId(getLookupArray(requestUnitsRes), requestId),
    bedsRaw,
    roomsRaw,
  );

  const dtos = rows
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is NonNullable<typeof u> => u != null);

  if (dtos.length === 0) return [];

  const snapshots = requestUnitDtosToEnrichedSnapshots(
    dtos,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  );

  return snapshots.map((u) => formatStoredUnitLabel(u)).filter(Boolean);
}

function pickRelationshipLabel(row: Record<string, unknown>): string {
  const direct = [
    row.relationshipName,
    row.RelationshipName,
    row.relationship,
    row.Relationship,
    row.relationName,
    row.RelationName,
  ]
    .map((v) => String(v ?? "").trim())
    .find(Boolean);
  if (direct) return direct;

  for (const navKey of ["relationship", "Relationship"] as const) {
    const nested = row[navKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const n = nested as Record<string, unknown>;
    const label = String(
      n.nameAr ?? n.NameAr ?? n.name ?? n.Name ?? n.nameEn ?? n.NameEn ?? "",
    ).trim();
    if (label) return label;
  }

  for (const navKey of ["companion", "Companion"] as const) {
    const nested = row[navKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const n = nested as Record<string, unknown>;
    const label = String(
      n.relationshipName ??
        n.RelationshipName ??
        n.relationship ??
        n.Relationship ??
        "",
    ).trim();
    if (label) return label;
  }

  return "—";
}

function companionsForRequest(
  requestRaw: Record<string, unknown>,
  participantsRes: unknown,
  requestId: string,
  companionById?: Map<string, ReceiverCompanionMeta>,
  relationshipLabelById?: Map<string, string>,
): Array<{ name: string; relationship: string; age?: number }> {
  const participantRows = resolveParticipantRowsForRequest(
    requestRaw,
    participantsRes,
    requestId,
  );
  const companionIds = extractCompanionIdsFromParticipantRows(participantRows);
  if (companionIds.length === 0) return [];

  const nameMap = buildCompanionNameMapFromParticipants(participantRows);
  return companionIds.map((id) => {
    const name = nameMap.get(id) ?? nameMap.get(id.trim().toLowerCase());
    const companionMeta =
      companionById?.get(id) ?? companionById?.get(id.trim().toLowerCase());
    const row =
      participantRows.find((r) => {
        const cid = String(r.companionId ?? r.CompanionId ?? "").trim();
        return cid.toLowerCase() === id.trim().toLowerCase();
      }) ?? null;
    const relationshipFromMetaId = (companionMeta?.relationshipId ?? "").trim();
    const relationshipFromMeta =
      (relationshipFromMetaId &&
        (relationshipLabelById?.get(relationshipFromMetaId) ??
          relationshipLabelById?.get(relationshipFromMetaId.toLowerCase()))) ||
      "";
    const resolvedName =
      name?.trim() || companionMeta?.name?.trim() || "";
    const relationshipFromCompanion = companionMeta?.relationshipName?.trim() || "";
    const resolvedRelationship =
      relationshipFromCompanion ||
      (row ? pickRelationshipLabel(row) : "") ||
      relationshipFromMeta ||
      "—";
    const resolvedAge = companionMeta?.age;

    return {
      name: resolvedName || "—",
      relationship: resolvedRelationship,
      ...(resolvedAge != null ? { age: resolvedAge } : {}),
    };
  })
    .filter((x) => x.name && x.name !== "—");
}

export function mapReservationToReceiverRow(
  reservation: ReservationDtoPayload,
  requestById: Map<string, Record<string, unknown>>,
  participantsRes: unknown,
  requestUnitsRes: unknown,
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
  companionById?: Map<string, ReceiverCompanionMeta>,
  relationshipLabelById?: Map<string, string>,
): ReceiverReservationRow {
  const requestId = reservation.requestId?.trim() ?? "";
  const requestRaw = requestId
    ? (requestById.get(requestId.toLowerCase()) ?? {})
    : {};
  const reservationUnits = requestId
    ? unitLabelsForRequest(
        requestId,
        requestUnitsRes,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      )
    : [];

  return {
    id: reservation.id ?? "",
    requestId,
    userName: extractApplicantDisplayNameFromRequest(requestRaw),
    room: reservationUnits.length > 0 ? reservationUnits.join("، ") : "—",
    reservationUnits,
    companions: companionsForRequest(
      requestRaw,
      participantsRes,
      requestId,
      companionById,
      relationshipLabelById,
    ),
    arrivalDate: formatReceiverDisplayDate(reservation.startDate),
    totalAmount: reservation.totalAmount,
    checkInAt: reservation.checkInDate || undefined,
    actualCheckOutAt: reservation.actualCheckOutDate || undefined,
    cancelationReason: reservation.cancelationReason || undefined,
    startDateYmd: reservation.startDate,
    endDateYmd: reservation.endDate,
    status: reservation.status,
  };
}

/** In-progress stays: `Reserved`, or checked-in (`Completed`) without departure yet. */
export function filterActiveReservationsToday(
  rows: ReceiverReservationRow[],
  todayYmd: string = todayYmdLocal(),
): ReceiverReservationRow[] {
  return rows.filter((row) => {
    if (row.endDateYmd < todayYmd) return false;
    if (row.startDateYmd > todayYmd) return false;

    if (row.status === RESERVATION_STATUS_RESERVED) return true;

    return (
      row.status === RESERVATION_STATUS_COMPLETED &&
      !String(row.actualCheckOutAt ?? "").trim()
    );
  });
}

/** Approved future `Reserved` stays (start after today). */
export function filterUpcomingReservations(
  rows: ReceiverReservationRow[],
  todayYmd: string = todayYmdLocal(),
): ReceiverReservationRow[] {
  return rows.filter(
    (row) =>
      row.status === RESERVATION_STATUS_RESERVED && row.startDateYmd > todayYmd,
  );
}

export type BuildReceiverReservationRowsResult =
  | { ok: true; rows: ReceiverReservationRow[] }
  | { ok: false; message: string };

export function buildReceiverReservationRows(input: {
  reservationsRes: unknown;
  requestsRes: unknown;
  participantsRes: unknown;
  requestUnitsRes: unknown;
  bedsRes: unknown;
  roomsRes: unknown;
  apartmentsRes: unknown;
  companionById?: Map<string, ReceiverCompanionMeta>;
  relationshipLabelById?: Map<string, string>;
}): BuildReceiverReservationRowsResult {
  const reservationsError = parseRequestServiceError(input.reservationsRes);
  if (reservationsError) {
    return { ok: false, message: reservationsError };
  }
  if (!isReservationApiSuccess(input.reservationsRes)) {
    return { ok: false, message: "تعذر تحميل الحجوزات من الخادم." };
  }

  const requestById = indexRequestsById(input.requestsRes);
  const bedsRaw = getLookupArray(input.bedsRes);
  const roomsRaw = getLookupArray(input.roomsRes);
  const apartmentsRaw = getLookupArray(input.apartmentsRes);

  const rows: ReceiverReservationRow[] = [];

  for (const item of parseReservationsListFromApi(input.reservationsRes)) {
    if (!item || typeof item !== "object") continue;
    const parsed = parseReservationFromApi(item as Record<string, unknown>);
    if (!parsed || parsed.isDeleted) continue;

    try {
      rows.push(
        mapReservationToReceiverRow(
          parsed,
          requestById,
          input.participantsRes,
          input.requestUnitsRes,
          bedsRaw,
          roomsRaw,
          apartmentsRaw,
          input.companionById,
          input.relationshipLabelById,
        ),
      );
    } catch {
      // Keep list rendering even if companion/unit enrichment fails for a row.
      rows.push({
        id: parsed.id ?? "",
        requestId: parsed.requestId ?? "",
        userName: "—",
        room: "—",
        reservationUnits: [],
        companions: [],
        arrivalDate: formatReceiverDisplayDate(parsed.startDate),
        totalAmount: parsed.totalAmount,
        checkInAt: parsed.checkInDate || undefined,
        actualCheckOutAt: parsed.actualCheckOutDate || undefined,
        cancelationReason: parsed.cancelationReason || undefined,
        startDateYmd: parsed.startDate,
        endDateYmd: parsed.endDate,
        status: parsed.status,
      });
    }
  }

  rows.sort((a, b) => b.startDateYmd.localeCompare(a.startDateYmd));

  return { ok: true, rows };
}
