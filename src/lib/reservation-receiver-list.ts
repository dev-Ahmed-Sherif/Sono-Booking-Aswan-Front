import { formatStoredUnitLabel, getLookupArray } from "@/lib/availability-inquiry";
import { extractApplicantDisplayNameFromRequest } from "@/lib/housing-request-list";
import {
  filterRowsByRequestId,
  parseRequestUnitFromApi,
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
  RESERVATION_STATUS_RESERVED,
  type ReservationDtoPayload,
  type ReservationStatus,
} from "@/lib/reservation-map";

export type ReceiverReservationRow = {
  id: string;
  requestId: string;
  userName: string;
  room: string;
  /** Formatted for table display. */
  arrivalDate: string;
  startDateYmd: string;
  endDateYmd: string;
  status: ReservationStatus;
};

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
): string {
  const rows = enrichRequestUnitRowsFromHierarchy(
    filterRowsByRequestId(getLookupArray(requestUnitsRes), requestId),
    bedsRaw,
    roomsRaw,
  );

  const dtos = rows
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is NonNullable<typeof u> => u != null);

  if (dtos.length === 0) return "—";

  const snapshots = requestUnitDtosToEnrichedSnapshots(
    dtos,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  );

  const labels = snapshots.map((u) => formatStoredUnitLabel(u)).filter(Boolean);
  return labels.length > 0 ? labels.join("، ") : "—";
}

export function mapReservationToReceiverRow(
  reservation: ReservationDtoPayload,
  requestById: Map<string, Record<string, unknown>>,
  requestUnitsRes: unknown,
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): ReceiverReservationRow {
  const requestRaw =
    requestById.get(reservation.requestId.toLowerCase()) ?? {};

  return {
    id: reservation.id,
    requestId: reservation.requestId,
    userName: extractApplicantDisplayNameFromRequest(requestRaw),
    room: unitLabelsForRequest(
      reservation.requestId,
      requestUnitsRes,
      bedsRaw,
      roomsRaw,
      apartmentsRaw,
    ),
    arrivalDate: formatReceiverDisplayDate(reservation.startDate),
    startDateYmd: reservation.startDate,
    endDateYmd: reservation.endDate,
    status: reservation.status,
  };
}

/** `Reserved` stays in progress (start on or before today, not ended). */
export function filterActiveReservationsToday(
  rows: ReceiverReservationRow[],
  todayYmd: string = todayYmdLocal(),
): ReceiverReservationRow[] {
  return rows.filter((row) => {
    if (row.status !== RESERVATION_STATUS_RESERVED) return false;
    if (row.endDateYmd < todayYmd) return false;
    return row.startDateYmd <= todayYmd;
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
  requestUnitsRes: unknown;
  bedsRes: unknown;
  roomsRes: unknown;
  apartmentsRes: unknown;
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

    rows.push(
      mapReservationToReceiverRow(
        parsed,
        requestById,
        input.requestUnitsRes,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      ),
    );
  }

  rows.sort((a, b) => b.startDateYmd.localeCompare(a.startDateYmd));

  return { ok: true, rows };
}
