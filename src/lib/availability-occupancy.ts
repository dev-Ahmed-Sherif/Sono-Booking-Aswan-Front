import {
  extractBlockingEndYmdFromUnitRow,
  isUnitFreeFromInquiryStart,
  maxYmd,
} from "@/lib/availability-dates";
import { extractNightsFromRequest, toYmd } from "@/lib/housing-request-list";

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

function resolveRequestEndYmd(raw: Record<string, unknown>): string | undefined {
  const end = toYmd(
    raw.endDate ??
      raw.EndDate ??
      raw.newEndDate ??
      raw.NewEndDate ??
      raw.extensionEndDate ??
      raw.ExtensionEndDate,
  );
  if (end) return end;
  const start = toYmd(
    raw.startDate ??
      raw.StartDate ??
      raw.newStartDate ??
      raw.NewStartDate ??
      raw.extensionStartDate ??
      raw.ExtensionStartDate,
  );
  const nights = extractNightsFromRequest(raw);
  if (!start || nights <= 0) return undefined;
  const d = new Date(`${start}T12:00:00`);
  d.setDate(d.getDate() + nights);
  return toYmd(d);
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
 * Builds latest request/extension end date per bed, room, and apartment from booking data.
 */
export function buildUnitBlockingEndIndex(input: {
  requestsRaw: unknown[];
  extensionsRaw: unknown[];
  requestUnitsRaw: unknown[];
  reservationsRaw?: unknown[];
  bedsRaw?: unknown[];
  roomsRaw?: unknown[];
}): UnitBlockingEndIndex {
  const beds = new Map<string, string>();
  const rooms = new Map<string, string>();
  const apartments = new Map<string, string>();

  const requestEndById = new Map<string, string>();
  for (const item of input.requestsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!requestStatusBlocksUnit(r.status ?? r.Status)) continue;
    const id = pickStr(r, "id", "Id");
    const endYmd = resolveRequestEndYmd(r);
    if (id && endYmd) requestEndById.set(id.toLowerCase(), endYmd);
  }

  const reservationToRequestId = new Map<string, string>();
  for (const item of input.reservationsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const reservationId = pickStr(r, "id", "Id");
    const requestId = pickStr(r, "requestId", "RequestId");
    if (reservationId && requestId) {
      reservationToRequestId.set(
        reservationId.toLowerCase(),
        requestId.toLowerCase(),
      );
    }
  }

  const extensionEndByRequestId = new Map<string, string>();
  for (const item of input.extensionsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (!requestStatusBlocksUnit(r.status ?? r.Status)) continue;
    const reservationId = pickStr(r, "reservationId", "ReservationId");
    const requestId =
      pickStr(r, "requestId", "RequestId") ||
      (reservationId
        ? reservationToRequestId.get(reservationId.toLowerCase())
        : undefined);
    const endYmd = resolveRequestEndYmd(r);
    if (!requestId || !endYmd) continue;
    const key = requestId.toLowerCase();
    const prev = extensionEndByRequestId.get(key);
    extensionEndByRequestId.set(key, maxYmd(prev, endYmd) ?? endYmd);
  }

  const resolveEndForRequest = (requestId: string): string | undefined => {
    const key = requestId.toLowerCase();
    return maxYmd(
      requestEndById.get(key),
      extensionEndByRequestId.get(key),
    );
  };

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
