import {
  extractBlockingEndYmdFromUnitRow,
  isUnitFreeFromInquiryStart,
  maxYmd,
} from "@/lib/availability-dates";
import { toYmd } from "@/lib/housing-request-list";

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function getLookupArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];
  const obj = response as Record<string, unknown>;
  const level1 =
    obj.data ?? obj.Data ?? obj.items ?? obj.Items ?? obj.result ?? obj.Result;
  if (Array.isArray(level1)) return level1;
  if (level1 && typeof level1 === "object") {
    const nested = level1 as Record<string, unknown>;
    const level2 =
      nested.data ??
      nested.Data ??
      nested.items ??
      nested.Items ??
      nested.result ??
      nested.Result;
    if (Array.isArray(level2)) return level2;
  }
  return [];
}

/** Status values that still hold a unit until `endDate`. */
function requestStatusBlocksUnit(status: unknown): boolean {
  if (status == null) return true;
  const n = typeof status === "number" ? status : Number(String(status).trim());
  if (Number.isFinite(n)) {
    if (n === 2 || n === 4) return false;
    return true;
  }
  const t = String(status).trim().toLowerCase();
  if (!t) return true;
  if (
    t.includes("reject") ||
    t.includes("cancel") ||
    t === "مرفوض" ||
    t === "ملغى" ||
    t === "ملغي"
  ) {
    return false;
  }
  return true;
}

/** Reservation statuses that no longer block a unit. */
function reservationStatusBlocksUnit(status: unknown): boolean {
  if (status == null) return true;
  const n = typeof status === "number" ? status : Number(String(status).trim());
  if (Number.isFinite(n)) {
    if (n === 3 || n === 4) return false;
    return true;
  }
  const t = String(status).trim().toLowerCase();
  if (!t) return true;
  if (
    t.includes("cancel") ||
    t.includes("noshow") ||
    t.includes("no-show") ||
    t === "ملغى" ||
    t === "ملغي" ||
    t === "لم يظهر"
  ) {
    return false;
  }
  return true;
}

/** Blocking end comes from reservation checkout only (date part of ActualCheckOutDate). */
function resolveBlockingEndForReservation(
  reservation: Record<string, unknown> | undefined,
): string | undefined {
  if (
    !reservation ||
    !reservationStatusBlocksUnit(reservation.status ?? reservation.Status)
  ) {
    return undefined;
  }
  return (
    toYmd(reservation.actualCheckOutDate ?? reservation.ActualCheckOutDate) ??
    toYmd(reservation.endDate ?? reservation.EndDate)
  );
}

export type UnitBlockingEndIndex = {
  beds: Map<string, string>;
  rooms: Map<string, string>;
  apartments: Map<string, string>;
};

function setBlocking(
  map: Map<string, string>,
  id: string | undefined,
  endYmd: string | undefined,
) {
  const key = id?.trim().toLowerCase();
  if (!key || !endYmd) return;
  const prev = map.get(key);
  map.set(key, maxYmd(prev, endYmd) ?? endYmd);
}

/**
 * Maps each unit to the latest reservation ActualCheckOutDate (date only) from booking data.
 */
export function buildUnitBlockingEndIndex(input: {
  requestsRaw: unknown[];
  extensionsRaw: unknown[];
  requestUnitsRaw: unknown[];
  reservationsRaw?: unknown[];
  bedsRaw?: unknown[];
  roomsRaw?: unknown[];
  /** Request ids whose unit holds must be ignored (e.g. editing an existing request). */
  excludeRequestIds?: string[];
}): UnitBlockingEndIndex {
  const beds = new Map<string, string>();
  const rooms = new Map<string, string>();
  const apartments = new Map<string, string>();

  const excludeRequestIds = new Set(
    (input.excludeRequestIds ?? [])
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean),
  );

  const reservationByRequestId = new Map<string, Record<string, unknown>>();
  const requestIdByReservationId = new Map<string, string>();
  for (const item of input.reservationsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const requestId = pickStr(r, "requestId", "RequestId");
    const reservationId = pickStr(r, "id", "Id");
    if (requestId) {
      reservationByRequestId.set(requestId.toLowerCase(), r);
      if (reservationId) {
        requestIdByReservationId.set(
          reservationId.toLowerCase(),
          requestId.toLowerCase(),
        );
      }
    }
  }

  const requestEndById = new Map<string, string>();
  const mergeRequestEnd = (requestId: string, endYmd: string) => {
    const key = requestId.trim().toLowerCase();
    if (!key || !endYmd) return;
    const prev = requestEndById.get(key);
    requestEndById.set(key, maxYmd(prev, endYmd) ?? endYmd);
  };

  for (const item of input.requestsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!requestStatusBlocksUnit(r.status ?? r.Status)) continue;
    const id = pickStr(r, "id", "Id");
    if (!id) continue;
    if (excludeRequestIds.has(id.toLowerCase())) continue;
    const reservation = reservationByRequestId.get(id.toLowerCase());
    const endYmd =
      resolveBlockingEndForReservation(reservation) ??
      toYmd(r.endDate ?? r.EndDate);
    if (endYmd) mergeRequestEnd(id, endYmd);
  }

  for (const item of input.extensionsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const ext = item as Record<string, unknown>;
    if (!requestStatusBlocksUnit(ext.status ?? ext.Status)) continue;
    const reservationId = pickStr(ext, "reservationId", "ReservationId");
    const endYmd = toYmd(ext.endDate ?? ext.EndDate);
    if (!reservationId || !endYmd) continue;
    const requestId = requestIdByReservationId.get(reservationId.toLowerCase());
    if (requestId) mergeRequestEnd(requestId, endYmd);
  }

  const previousRequestById = new Map<string, string>();
  for (const item of input.requestsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    const previousId = pickStr(r, "previousRequestId", "PreviousRequestId");
    if (id && previousId) previousRequestById.set(id.toLowerCase(), previousId.toLowerCase());
  }

  const resolveRootStayRequestId = (requestId: string): string => {
    let current = requestId.trim().toLowerCase();
    const visited = new Set<string>();
    while (previousRequestById.has(current)) {
      if (visited.has(current)) break;
      visited.add(current);
      current = previousRequestById.get(current)!;
    }
    return current;
  };

  for (const item of input.requestsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!requestStatusBlocksUnit(r.status ?? r.Status)) continue;
    const category = pickStr(r, "requestCatagory", "RequestCatagory").toLowerCase();
    if (category !== "extension" && category !== "2") continue;
    const id = pickStr(r, "id", "Id");
    const previousId = pickStr(r, "previousRequestId", "PreviousRequestId");
    const endYmd = toYmd(r.endDate ?? r.EndDate);
    if (!id || !previousId || !endYmd) continue;
    if (excludeRequestIds.has(id.toLowerCase())) continue;
    mergeRequestEnd(id, endYmd);
    mergeRequestEnd(resolveRootStayRequestId(previousId), endYmd);
  }

  const resolveEndForRequest = (requestId: string): string | undefined =>
    requestEndById.get(requestId.toLowerCase());

  const bedById = new Map<string, Record<string, unknown>>();
  for (const item of input.bedsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const id = pickStr(item as Record<string, unknown>, "id", "Id");
    if (id) bedById.set(id.toLowerCase(), item as Record<string, unknown>);
  }

  const roomById = new Map<string, Record<string, unknown>>();
  for (const item of input.roomsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const id = pickStr(item as Record<string, unknown>, "id", "Id");
    if (id) roomById.set(id.toLowerCase(), item as Record<string, unknown>);
  }

  for (const item of input.requestUnitsRaw) {
    if (!item || typeof item !== "object") continue;
    const u = item as Record<string, unknown>;
    const requestId = pickStr(u, "requestId", "RequestId");
    if (!requestId) continue;
    if (excludeRequestIds.has(requestId.toLowerCase())) continue;
    const endYmd = resolveEndForRequest(requestId);
    if (!endYmd) continue;

    const bedId = pickStr(u, "bedId", "BedId");
    const roomId = pickStr(u, "roomId", "RoomId");
    let apartmentId = pickStr(u, "apartmentId", "ApartmentId");

    if (!apartmentId && bedId) {
      const bed = bedById.get(bedId.toLowerCase());
      if (bed) {
        apartmentId = pickStr(bed, "apartmentId", "ApartmentId");
        const roomFromBed = pickStr(bed, "roomId", "RoomId");
        if (!roomId && roomFromBed) {
          setBlocking(rooms, roomFromBed, endYmd);
        }
      }
    }

    if (!apartmentId && roomId) {
      const room = roomById.get(roomId.toLowerCase());
      if (room) {
        apartmentId = pickStr(room, "apartmentId", "ApartmentId");
      }
    }

    if (bedId) setBlocking(beds, bedId, endYmd);
    if (roomId) setBlocking(rooms, roomId, endYmd);
    if (apartmentId) setBlocking(apartments, apartmentId, endYmd);
  }

  return { beds, rooms, apartments };
}

export function blockingEndForBedRow(
  row: Record<string, unknown>,
  index: UnitBlockingEndIndex,
  roomById: Map<string, Record<string, unknown>>,
  aptById: Map<string, Record<string, unknown>>,
): string | undefined {
  const bedId = pickStr(row, "id", "Id");
  const roomId = pickStr(row, "roomId", "RoomId");
  const room = roomId ? roomById.get(roomId.toLowerCase()) : undefined;
  const aptId =
    pickStr(row, "apartmentId", "ApartmentId") ||
    (room ? pickStr(room, "apartmentId", "ApartmentId") : "");

  return maxYmd(
    extractBlockingEndYmdFromUnitRow(row),
    bedId ? index.beds.get(bedId.toLowerCase()) : undefined,
    roomId ? index.rooms.get(roomId.toLowerCase()) : undefined,
    aptId ? index.apartments.get(aptId.toLowerCase()) : undefined,
  );
}

export function blockingEndForRoomRow(
  row: Record<string, unknown>,
  index: UnitBlockingEndIndex,
  aptById: Map<string, Record<string, unknown>>,
): string | undefined {
  const roomId = pickStr(row, "id", "Id");
  const aptId = pickStr(row, "apartmentId", "ApartmentId");
  return maxYmd(
    extractBlockingEndYmdFromUnitRow(row),
    roomId ? index.rooms.get(roomId.toLowerCase()) : undefined,
    aptId ? index.apartments.get(aptId.toLowerCase()) : undefined,
  );
}

export function blockingEndForApartmentRow(
  row: Record<string, unknown>,
  index: UnitBlockingEndIndex,
): string | undefined {
  const aptId = pickStr(row, "id", "Id");
  return maxYmd(
    extractBlockingEndYmdFromUnitRow(row),
    aptId ? index.apartments.get(aptId.toLowerCase()) : undefined,
  );
}

export function filterAvailabilityListsByOccupancy(
  input: {
    apartments: unknown[];
    rooms: unknown[];
    beds: unknown[];
  },
  inquiryStartYmd: string | undefined,
  index: UnitBlockingEndIndex | null,
): {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
} {
  if (!inquiryStartYmd) return input;

  const aptById = new Map<string, Record<string, unknown>>();
  for (const item of input.apartments) {
    if (!item || typeof item !== "object") continue;
    const id = pickStr(item as Record<string, unknown>, "id", "Id");
    if (id) aptById.set(id.toLowerCase(), item as Record<string, unknown>);
  }

  const roomById = new Map<string, Record<string, unknown>>();
  for (const item of input.rooms) {
    if (!item || typeof item !== "object") continue;
    const id = pickStr(item as Record<string, unknown>, "id", "Id");
    if (id) roomById.set(id.toLowerCase(), item as Record<string, unknown>);
  }

  const apartments = input.apartments.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const bookingEnd = index
      ? blockingEndForApartmentRow(row, index)
      : undefined;
    return isUnitFreeFromInquiryStart(
      inquiryStartYmd,
      bookingEnd,
    );
  });

  const rooms = input.rooms.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const bookingEnd = index
      ? blockingEndForRoomRow(row, index, aptById)
      : undefined;
    return isUnitFreeFromInquiryStart(
      inquiryStartYmd,
      bookingEnd,
    );
  });

  const beds = input.beds.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const bookingEnd = index
      ? blockingEndForBedRow(row, index, roomById, aptById)
      : undefined;
    return isUnitFreeFromInquiryStart(
      inquiryStartYmd,
      bookingEnd,
    );
  });

  return { apartments, rooms, beds };
}

/** Latest blocking checkout date for a stored unit snapshot. */
export function blockingEndForStoredUnit(
  unit: {
    id: string;
    unitKind: string;
    roomId?: string;
    apartmentId?: string;
  },
  index: UnitBlockingEndIndex | null,
): string | undefined {
  if (!index) return undefined;
  const id = unit.id.trim().toLowerCase();
  if (unit.unitKind === "bed") {
    return maxYmd(
      index.beds.get(id),
      unit.roomId ? index.rooms.get(unit.roomId.trim().toLowerCase()) : undefined,
      unit.apartmentId
        ? index.apartments.get(unit.apartmentId.trim().toLowerCase())
        : undefined,
    );
  }
  if (unit.unitKind === "room") {
    return maxYmd(
      index.rooms.get(id),
      unit.apartmentId
        ? index.apartments.get(unit.apartmentId.trim().toLowerCase())
        : undefined,
    );
  }
  return index.apartments.get(id);
}

export function parseAvailabilityBookingArrays(responses: {
  requestsRes: unknown;
  extensionsRes: unknown;
  requestUnitsRes: unknown;
  reservationsRes?: unknown;
}): {
  requestsRaw: unknown[];
  extensionsRaw: unknown[];
  requestUnitsRaw: unknown[];
  reservationsRaw: unknown[];
} {
  const hasError = (res: unknown) =>
    res != null && typeof res === "object" && "error" in res;

  return {
    requestsRaw: hasError(responses.requestsRes)
      ? []
      : getLookupArray(responses.requestsRes),
    extensionsRaw: hasError(responses.extensionsRes)
      ? []
      : getLookupArray(responses.extensionsRes),
    requestUnitsRaw: hasError(responses.requestUnitsRes)
      ? []
      : getLookupArray(responses.requestUnitsRes),
    reservationsRaw: hasError(responses.reservationsRes)
      ? []
      : getLookupArray(responses.reservationsRes ?? []),
  };
}
