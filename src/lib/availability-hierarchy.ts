import {
  filterUnitsByInquiryStartDate,
  type AvailabilityInquiryDates,
} from "@/lib/availability-dates";
import {
  filterAvailabilityListsByOccupancy,
  type UnitBlockingEndIndex,
} from "@/lib/availability-occupancy";

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

/** Hide rooms whose parent apartment is not available (reserved / occupied). */
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

/** Hide beds whose parent room is not available (reserved / occupied). */
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
};

/** Apply apartment → room → bed hierarchy and optional inquiry date filters. */
export function applyAvailabilityHierarchyFilters(
  input: AvailabilityHierarchyFilterInput,
): {
  apartments: unknown[];
  rooms: unknown[];
  beds: unknown[];
} {
  const inquiryStartYmd = input.inquiry?.startDateYmd?.trim();

  let apartments = input.apartments;
  let rooms = input.rooms;
  let beds = input.beds;

  if (inquiryStartYmd) {
    apartments = filterUnitsByInquiryStartDate(apartments, inquiryStartYmd);
    rooms = filterUnitsByInquiryStartDate(rooms, inquiryStartYmd);
    beds = filterUnitsByInquiryStartDate(beds, inquiryStartYmd);

    const occupancyFiltered = filterAvailabilityListsByOccupancy(
      { apartments, rooms, beds },
      inquiryStartYmd,
      input.occupancyIndex ?? null,
    );
    apartments = occupancyFiltered.apartments;
    rooms = occupancyFiltered.rooms;
    beds = occupancyFiltered.beds;
  }

  rooms = filterRoomsWithAvailableApartment(rooms, apartments);
  beds = filterBedsWithAvailableRoom(beds, rooms);
  return { apartments, rooms, beds };
}
