import {
  formatStoredUnitHierarchyLabel,
  getLookupArray,
  UNIT_TYPE_LABEL_AR,
  type ReservationStoredUnitSnapshot,
} from "@/lib/availability-inquiry";
import { parseBirthDateValue } from "@/lib/companion-registration";
import {
  formatUtcToCairo,
  formatUtcToCairoDate,
  todayYmdCairo,
} from "@/lib/date-timeOptions";
import {
  extractApplicantDisplayNameFromRequest,
  extractRequestPercentage,
  isHousingRequestRecordDeleted,
} from "@/lib/housing-request-list";
import {
  buildCompanionNameMapFromParticipants,
  extractCompanionIdsFromParticipantRows,
  filterRowsByRequestId,
  parseRequestUnitFromApi,
  resolveParticipantRowsForRequest,
  resolveRequestLinkedContentRequestId,
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
  RESERVATION_STATUS_CANCELED,
  RESERVATION_STATUS_CHECKOUT,
  RESERVATION_STATUS_COMPLETED,
  RESERVATION_STATUS_NO_SHOW,
  RESERVATION_STATUS_RESERVED,
  resolveReservationActualCheckInAt,
  resolveReservationActualCheckOutAt,
  type ReservationDtoPayload,
  type ReservationStatus,
} from "@/lib/reservation-map";

export type ReceiverReservationRow = {
  id: string;
  requestId: string;
  userName: string;
  room: string;
  reservationUnits: string[];
  reservationUnitSnapshots: ReservationStoredUnitSnapshot[];
  companions: Array<{ name: string; relationship: string; age?: number }>;
  /** Formatted for table display. */
  arrivalDate: string;
  /** Reservation `TotalAmount` from API (used before payment / discount base). */
  reservationTotalAmount: number;
  /** `Payment.Amount` when a payment row exists for this reservation. */
  paymentAmount?: number;
  /** Saved leader discount from `Request.Percentage` (0–100). */
  discountPercent: number;
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
  return todayYmdCairo();
}

export function formatReceiverDisplayDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
  return formatUtcToCairoDate(`${ymd}T12:00:00Z`);
}

export function formatReceiverDisplayDateTime(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const formatted = formatUtcToCairo(raw);
  return formatted === "-" ? raw : formatted;
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

function unitSnapshotsForRequest(
  requestId: string,
  requestUnitsRes: unknown,
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): ReservationStoredUnitSnapshot[] {
  const rows = enrichRequestUnitRowsFromHierarchy(
    filterRowsByRequestId(getLookupArray(requestUnitsRes), requestId),
    bedsRaw,
    roomsRaw,
  );

  const dtos = rows
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is NonNullable<typeof u> => u != null);

  if (dtos.length === 0) return [];

  return requestUnitDtosToEnrichedSnapshots(
    dtos,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  );
}

export type ReceiverUnitHierarchyCells = {
  apartment: string;
  room: string;
  unit: string;
};

/** Table cells for apartment → room → bed hierarchy in receiver detail modal. */
export function receiverUnitHierarchyCells(
  unit: ReservationStoredUnitSnapshot,
): ReceiverUnitHierarchyCells {
  const dash = "—";
  const leaf =
    unit.title?.trim() ||
    UNIT_TYPE_LABEL_AR[unit.unitKind] ||
    "وحدة";

  if (unit.unitKind === "apartment") {
    return { apartment: leaf, room: dash, unit: dash };
  }

  if (unit.unitKind === "room") {
    return {
      apartment: unit.parentApartmentLabel?.trim() || dash,
      room: leaf,
      unit: dash,
    };
  }

  return {
    apartment: unit.parentApartmentLabel?.trim() || dash,
    room: unit.parentRoomLabel?.trim() || dash,
    unit: leaf,
  };
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
  const linkedRequestId = requestId
    ? resolveRequestLinkedContentRequestId(requestRaw, requestId)
    : "";
  const contentRequestRaw =
    linkedRequestId &&
    linkedRequestId.toLowerCase() !== requestId.toLowerCase()
      ? (requestById.get(linkedRequestId.toLowerCase()) ?? requestRaw)
      : requestRaw;
  const reservationUnitSnapshots = linkedRequestId
    ? unitSnapshotsForRequest(
        linkedRequestId,
        requestUnitsRes,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      )
    : [];
  const reservationUnits = reservationUnitSnapshots
    .map((u) => formatStoredUnitHierarchyLabel(u))
    .filter(Boolean);

  const reservationId = reservation.id?.trim() ?? "";

  return {
    id: reservationId,
    requestId,
    userName: extractApplicantDisplayNameFromRequest(requestRaw),
    room: reservationUnits.length > 0 ? reservationUnits.join("، ") : "—",
    reservationUnits,
    reservationUnitSnapshots,
    companions: companionsForRequest(
      contentRequestRaw,
      participantsRes,
      linkedRequestId || requestId,
      companionById,
      relationshipLabelById,
    ),
    arrivalDate: formatReceiverDisplayDate(reservation.startDate),
    reservationTotalAmount: reservation.totalAmount,
    ...(reservation.paymentAmount != null
      ? { paymentAmount: reservation.paymentAmount }
      : {}),
    discountPercent: extractRequestPercentage(requestRaw),
    checkInAt: resolveReservationActualCheckInAt(reservation),
    actualCheckOutAt: resolveReservationActualCheckOutAt(reservation),
    cancelationReason: reservation.cancelationReason || undefined,
    startDateYmd: reservation.startDate,
    endDateYmd: reservation.endDate,
    status: reservation.status,
  };
}

/**
 * Guest has departed (تسجيل مغادرة). Prefer reservation status; fall back for legacy rows.
 */
export function hasReservationDeparted(row: {
  status?: ReservationStatus;
  checkInAt?: string;
  actualCheckOutAt?: string;
}): boolean {
  if (row.status === RESERVATION_STATUS_CHECKOUT) return true;

  const checkIn = String(row.checkInAt ?? "").trim();
  const checkOut = String(row.actualCheckOutAt ?? "").trim();
  if (!checkOut || !checkIn) return false;

  const checkInMs = new Date(checkIn).getTime();
  const checkOutMs = new Date(checkOut).getTime();
  if (Number.isNaN(checkInMs) || Number.isNaN(checkOutMs)) {
    return checkOut > checkIn;
  }

  return checkOutMs - checkInMs > 60_000;
}

/**
 * Checked-in (`Completed`) and not yet checked out (`Checkout`).
 */
export function isReservationStillInHouse(row: {
  status: ReservationStatus;
  checkInAt?: string;
  actualCheckOutAt?: string;
}): boolean {
  if (row.status === RESERVATION_STATUS_CHECKOUT) return false;
  return row.status === RESERVATION_STATUS_COMPLETED;
}

function sortReceiverReservationRowsAsc(
  rows: ReceiverReservationRow[],
): ReceiverReservationRow[] {
  return [...rows].sort((a, b) => {
    const byStart = a.startDateYmd.localeCompare(b.startDateYmd);
    if (byStart !== 0) return byStart;
    return a.userName.localeCompare(b.userName, "ar", { sensitivity: "base" });
  });
}

/**
 * Active tab (reception):
 * - `Reserved` arrivals whose start date is today
 * - `Reserved` stays that started earlier but have not ended yet (`endDate >= today`)
 * - `Completed` guests still in-house from earlier check-ins
 */
export function filterActiveReservationsToday(
  rows: ReceiverReservationRow[],
  todayYmd: string = todayYmdLocal(),
): ReceiverReservationRow[] {
  return sortReceiverReservationRowsAsc(
    rows.filter((row) => {
      if (
        row.status === RESERVATION_STATUS_CANCELED ||
        row.status === RESERVATION_STATUS_CHECKOUT ||
        row.status === RESERVATION_STATUS_NO_SHOW
      ) {
        return false;
      }

      if (row.status === RESERVATION_STATUS_RESERVED) {
        if (row.startDateYmd === todayYmd) {
          return true;
        }

        if (
          row.startDateYmd < todayYmd &&
          row.endDateYmd >= todayYmd
        ) {
          return true;
        }
      }

      if (
        row.status === RESERVATION_STATUS_COMPLETED &&
        isReservationStillInHouse(row)
      ) {
        return true;
      }

      return false;
    }),
  );
}

export function isReservationEndDateBeforeToday(
  endDateYmd: string,
  todayYmd: string = todayYmdLocal(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateYmd)) return false;
  return endDateYmd < todayYmd;
}

/** Canceled / no-show rows can be restored only while the stay end date is still today or later. */
export function canRestoreReceiverReservation(
  row: Pick<ReceiverReservationRow, "status" | "endDateYmd">,
  todayYmd: string = todayYmdLocal(),
): boolean {
  if (
    row.status !== RESERVATION_STATUS_CANCELED &&
    row.status !== RESERVATION_STATUS_NO_SHOW
  ) {
    return false;
  }

  return !isReservationEndDateBeforeToday(row.endDateYmd, todayYmd);
}

/** Approved future `Reserved` stays (start after today). */
export function filterUpcomingReservations(
  rows: ReceiverReservationRow[],
  todayYmd: string = todayYmdLocal(),
): ReceiverReservationRow[] {
  return sortReceiverReservationRowsAsc(
    rows.filter(
      (row) =>
        row.status === RESERVATION_STATUS_RESERVED && row.startDateYmd > todayYmd,
    ),
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
  if (
    !isReservationApiSuccess(input.reservationsRes) &&
    !Array.isArray(input.reservationsRes)
  ) {
    return { ok: false, message: "تعذر تحميل الحجوزات من الخادم." };
  }

  const requestById = indexRequestsById(input.requestsRes);
  const bedsRaw = getLookupArray(input.bedsRes);
  const roomsRaw = getLookupArray(input.roomsRes);
  const apartmentsRaw = getLookupArray(input.apartmentsRes);

  const rows: ReceiverReservationRow[] = [];

  for (const item of parseReservationsListFromApi(input.reservationsRes)) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (isHousingRequestRecordDeleted(raw)) continue;

    const parsed = parseReservationFromApi(raw);
    if (!parsed) continue;

    const requestId = parsed.requestId?.trim() ?? "";
    if (requestId) {
      const requestRaw = requestById.get(requestId.toLowerCase());
      if (requestRaw && isHousingRequestRecordDeleted(requestRaw)) continue;
    }

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
      const requestId = parsed.requestId?.trim() ?? "";
      const requestRaw = requestId
        ? (requestById.get(requestId.toLowerCase()) ?? {})
        : {};
      // Keep list rendering even if companion/unit enrichment fails for a row.
      rows.push({
        id: parsed.id?.trim() ?? "",
        requestId,
        userName: "—",
        room: "—",
        reservationUnits: [],
        reservationUnitSnapshots: [],
        companions: [],
        arrivalDate: formatReceiverDisplayDate(parsed.startDate),
        reservationTotalAmount: parsed.totalAmount,
        ...(parsed.paymentAmount != null
          ? { paymentAmount: parsed.paymentAmount }
          : {}),
        discountPercent: extractRequestPercentage(requestRaw),
        checkInAt: resolveReservationActualCheckInAt(parsed),
        actualCheckOutAt: resolveReservationActualCheckOutAt(parsed),
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
