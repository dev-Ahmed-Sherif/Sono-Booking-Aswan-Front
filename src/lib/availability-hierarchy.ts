import type { AvailabilityInquiryDates } from "@/lib/availability-dates";
import type { UnitBlockingEndIndex } from "@/lib/availability-occupancy";

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

export type AvailabilityHierarchyFilterInput = {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
  inquiry?: AvailabilityInquiryDates;
  occupancyIndex?: UnitBlockingEndIndex | null;
  hierarchyRaw?: {
    apartmentsRaw?: unknown[];
    roomsRaw?: unknown[];
  };
};

/**
 * Wires apartment → room → bed hierarchy.
 * When inquiry start is set, date occupancy is handled by the API (StartDate header).
 */
export function applyAvailabilityHierarchyFilters(
  input: AvailabilityHierarchyFilterInput,
): {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
} {
  let apartments = input.apartments;
  let rooms = filterRoomsWithAvailableApartment(input.rooms, apartments);
  let beds = filterBedsWithAvailableRoom(input.beds, rooms);

  return { apartments, rooms, beds };
}
