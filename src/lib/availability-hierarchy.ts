import type { AvailabilityInquiryDates } from "@/lib/availability-dates";
import type { UnitBlockingEndIndex } from "@/lib/availability-occupancy";
import { UNIT_STATUS_RESERVED } from "@/lib/unit-reserve-form";

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function rowIdKey(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  return pickStr(item as Record<string, unknown>, "id", "Id").toLowerCase();
}

function indexRowIds(rows: unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const item of rows) {
    const id = rowIdKey(item);
    if (id) ids.add(id);
  }
  return ids;
}

/** Hide rooms whose parent apartment is not in the filtered apartment list. */
export function filterRoomsWithAvailableApartment(
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): unknown[] {
  const aptIds = indexRowIds(apartmentsRaw);
  if (aptIds.size === 0) return [];

  return roomsRaw.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const aptId = pickStr(
      item as Record<string, unknown>,
      "apartmentId",
      "ApartmentId",
    ).toLowerCase();
    return aptId.length > 0 && aptIds.has(aptId);
  });
}

/** Hide beds whose parent room is not in the filtered room list. */
export function filterBedsWithAvailableRoom(
  bedsRaw: unknown[],
  roomsRaw: unknown[],
): unknown[] {
  const roomIds = indexRowIds(roomsRaw);
  if (roomIds.size === 0) return [];

  return bedsRaw.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const roomId = pickStr(
      item as Record<string, unknown>,
      "roomId",
      "RoomId",
    ).toLowerCase();
    return roomId.length > 0 && roomIds.has(roomId);
  });
}

function normalizeCatalogUnitStatus(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return s;
  const map: Record<string, string> = {
    Available: "1",
    Reserved: UNIT_STATUS_RESERVED,
    Occupied: "3",
    AVAILABLE: "1",
    RESERVED: UNIT_STATUS_RESERVED,
    OCCUPIED: "3",
    متاح: "1",
    محجوز: UNIT_STATUS_RESERVED,
    مشغول: "3",
    متاحة: "1",
    محجوزة: UNIT_STATUS_RESERVED,
    مشغولة: "3",
  };
  return map[s] ?? s;
}

function isReservedCatalogRow(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  return (
    normalizeCatalogUnitStatus(row.status ?? row.Status) ===
    UNIT_STATUS_RESERVED
  );
}

function roomIdToApartmentIdMap(roomsRaw: unknown[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of roomsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const roomId = rowIdKey(item);
    const aptId = pickStr(row, "apartmentId", "ApartmentId").toLowerCase();
    if (roomId && aptId) map.set(roomId, aptId);
  }
  return map;
}

/**
 * Hide rooms that have a reserved child bed which is not in the availability list
 * (e.g. still blocked for the inquiry dates).
 */
export function filterRoomsWithoutReservedBeds(
  roomsRaw: unknown[],
  catalogBedsRaw: unknown[],
  availableBedsRaw: unknown[],
): unknown[] {
  const availableBedIds = indexRowIds(availableBedsRaw);
  const blockedRoomIds = new Set<string>();

  for (const bed of catalogBedsRaw) {
    if (!isReservedCatalogRow(bed)) continue;
    const bedId = rowIdKey(bed);
    if (bedId && availableBedIds.has(bedId)) continue;
    const roomId = pickStr(
      bed as Record<string, unknown>,
      "roomId",
      "RoomId",
    ).toLowerCase();
    if (roomId) blockedRoomIds.add(roomId);
  }

  if (blockedRoomIds.size === 0) return roomsRaw;

  return roomsRaw.filter((item) => {
    const id = rowIdKey(item);
    return id.length > 0 && !blockedRoomIds.has(id);
  });
}

/**
 * Hide apartments that have a reserved child room or bed which is not in the
 * availability lists (e.g. still blocked for the inquiry dates).
 */
export function filterApartmentsWithoutReservedChildren(
  apartmentsRaw: unknown[],
  catalogRoomsRaw: unknown[],
  catalogBedsRaw: unknown[],
  availableRoomsRaw: unknown[],
  availableBedsRaw: unknown[],
): unknown[] {
  const availableRoomIds = indexRowIds(availableRoomsRaw);
  const availableBedIds = indexRowIds(availableBedsRaw);
  const roomToApt = roomIdToApartmentIdMap(catalogRoomsRaw);
  const blockedAptIds = new Set<string>();

  for (const room of catalogRoomsRaw) {
    if (!isReservedCatalogRow(room)) continue;
    const roomId = rowIdKey(room);
    if (roomId && availableRoomIds.has(roomId)) continue;
    const aptId = pickStr(
      room as Record<string, unknown>,
      "apartmentId",
      "ApartmentId",
    ).toLowerCase();
    if (aptId) blockedAptIds.add(aptId);
  }

  for (const bed of catalogBedsRaw) {
    if (!isReservedCatalogRow(bed)) continue;
    const bedId = rowIdKey(bed);
    if (bedId && availableBedIds.has(bedId)) continue;
    const roomId = pickStr(
      bed as Record<string, unknown>,
      "roomId",
      "RoomId",
    ).toLowerCase();
    const aptId = roomId ? roomToApt.get(roomId) : undefined;
    if (aptId) blockedAptIds.add(aptId);
  }

  if (blockedAptIds.size === 0) return apartmentsRaw;

  return apartmentsRaw.filter((item) => {
    const id = rowIdKey(item);
    return id.length > 0 && !blockedAptIds.has(id);
  });
}

export type AvailabilityHierarchyFilterInput = {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
  /** Full catalog beds (all statuses) for reserved-child parent hiding. */
  catalogBeds?: unknown[];
  /** Full catalog rooms (all statuses) for reserved-child parent hiding. */
  catalogRooms?: unknown[];
  inquiry?: AvailabilityInquiryDates;
  occupancyIndex?: UnitBlockingEndIndex | null;
  hierarchyRaw?: {
    apartmentsRaw?: unknown[];
    roomsRaw?: unknown[];
  };
};

/**
 * Wires apartment → room → bed hierarchy.
 *
 * - **Apartment search**: hides apartments with any reserved child room or bed.
 * - **Room search**: hides rooms with any reserved child bed.
 * - **Bed search**: keeps available beds even when a sibling bed in the same room
 *   is reserved (parent room hiding does not cascade to beds).
 *
 * When inquiry start is set, date occupancy is handled by the API (StartDate header).
 */
export function applyAvailabilityHierarchyFilters(
  input: AvailabilityHierarchyFilterInput,
): {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
} {
  const catalogBeds = input.catalogBeds ?? [];
  const catalogRooms = input.catalogRooms ?? [];
  const hasCatalog =
    catalogBeds.length > 0 || catalogRooms.length > 0;

  const apartmentsForSearch = hasCatalog
    ? filterApartmentsWithoutReservedChildren(
        input.apartments,
        catalogRooms,
        catalogBeds,
        input.rooms,
        input.beds,
      )
    : input.apartments;

  const roomsInAvailableApartments = filterRoomsWithAvailableApartment(
    input.rooms,
    apartmentsForSearch,
  );

  const roomsForSearch = hasCatalog
    ? filterRoomsWithoutReservedBeds(
        roomsInAvailableApartments,
        catalogBeds,
        input.beds,
      )
    : roomsInAvailableApartments;

  const roomsForBeds = filterRoomsWithAvailableApartment(
    input.rooms,
    input.apartments,
  );
  const beds = filterBedsWithAvailableRoom(input.beds, roomsForBeds);

  return {
    apartments: apartmentsForSearch,
    rooms: roomsForSearch,
    beds,
  };
}
