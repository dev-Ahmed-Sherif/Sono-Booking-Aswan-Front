import {
  isUnitFreeFromInquiryStart,
  type AvailabilityInquiryDates,
} from "@/lib/availability-dates";
import {
  blockingEndForApartmentRow,
  blockingEndForBedRow,
  blockingEndForRoomRow,
  type UnitBlockingEndIndex,
} from "@/lib/availability-occupancy";
import {
  UNIT_STATUS_AVAILABLE,
  UNIT_STATUS_OCCUPIED,
  UNIT_STATUS_RESERVED,
} from "@/lib/unit-reserve-form";

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

function catalogRowsById(rows: unknown[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const id = rowIdKey(item);
    if (id) map.set(id, item as Record<string, unknown>);
  }
  return map;
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
    Available: UNIT_STATUS_AVAILABLE,
    Reserved: UNIT_STATUS_RESERVED,
    Occupied: UNIT_STATUS_OCCUPIED,
    AVAILABLE: UNIT_STATUS_AVAILABLE,
    RESERVED: UNIT_STATUS_RESERVED,
    OCCUPIED: UNIT_STATUS_OCCUPIED,
    متاح: UNIT_STATUS_AVAILABLE,
    محجوز: UNIT_STATUS_RESERVED,
    مشغول: UNIT_STATUS_OCCUPIED,
    متاحة: UNIT_STATUS_AVAILABLE,
    محجوزة: UNIT_STATUS_RESERVED,
    مشغولة: UNIT_STATUS_OCCUPIED,
  };
  return map[s] ?? s;
}

/** Reserved or occupied in the housing catalog (not bookable as-is). */
export function isReservedOrOccupiedUnitRow(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  const status = normalizeCatalogUnitStatus(row.status ?? row.Status);
  return status === UNIT_STATUS_RESERVED || status === UNIT_STATUS_OCCUPIED;
}

function isUnavailableCatalogRow(item: unknown): boolean {
  return isReservedOrOccupiedUnitRow(item);
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

type ChildBlockingContext = {
  inquiry?: AvailabilityInquiryDates;
  occupancyIndex?: UnitBlockingEndIndex | null;
  roomById: Map<string, Record<string, unknown>>;
  aptById: Map<string, Record<string, unknown>>;
};

/**
 * A catalog child blocks its parent when it is reserved/occupied, or missing from
 * availability results while still blocked for the inquiry.
 */
function isChildBlockingParent(
  row: unknown,
  availableIds: Set<string>,
  kind: "bed" | "room",
  ctx: ChildBlockingContext,
): boolean {
  const id = rowIdKey(row);
  if (!id) return false;

  // Inquiry API lists already passed date filtering for this child.
  if (availableIds.has(id)) return false;

  const inquiryYmd = ctx.inquiry?.startDateYmd?.trim();
  if (inquiryYmd && ctx.occupancyIndex) {
    const record = row as Record<string, unknown>;
    const blockingEnd =
      kind === "bed"
        ? blockingEndForBedRow(
            record,
            ctx.occupancyIndex,
            ctx.roomById,
            ctx.aptById,
          )
        : blockingEndForRoomRow(record, ctx.occupancyIndex, ctx.aptById);
    if (blockingEnd) {
      return !isUnitFreeFromInquiryStart(inquiryYmd, blockingEnd);
    }
    return false;
  }

  // No inquiry window: reserved/occupied catalog children block their parent.
  if (isUnavailableCatalogRow(row)) return true;

  return false;
}

/** Remove reserved/occupied rows that should not appear as bookable cards. */
export function stripUnbookableUnitRows(
  rows: unknown[],
  inquiry: AvailabilityInquiryDates | undefined,
  ctx: ChildBlockingContext,
  kind: "bed" | "room" | "apartment",
): unknown[] {
  return rows.filter((row) => {
    if (!isReservedOrOccupiedUnitRow(row)) return true;
    const inquiryYmd = inquiry?.startDateYmd?.trim();
    if (!inquiryYmd) return false;
    if (!ctx.occupancyIndex) return false;

    const record = row as Record<string, unknown>;
    const blockingEnd =
      kind === "bed"
        ? blockingEndForBedRow(record, ctx.occupancyIndex, ctx.roomById, ctx.aptById)
        : kind === "room"
          ? blockingEndForRoomRow(record, ctx.occupancyIndex, ctx.aptById)
          : blockingEndForApartmentRow(record, ctx.occupancyIndex);

    if (!blockingEnd) return false;
    return isUnitFreeFromInquiryStart(inquiryYmd, blockingEnd);
  });
}

/**
 * Hide rooms that have a reserved/occupied child bed which is not in the
 * availability list (e.g. still blocked for the inquiry dates).
 */
export function filterRoomsWithoutReservedBeds(
  roomsRaw: unknown[],
  catalogBedsRaw: unknown[],
  availableBedsRaw: unknown[],
  ctx: ChildBlockingContext = {
    roomById: new Map(),
    aptById: new Map(),
  },
): unknown[] {
  const availableBedIds = indexRowIds(availableBedsRaw);
  const blockedRoomIds = new Set<string>();

  for (const bed of catalogBedsRaw) {
    if (!isChildBlockingParent(bed, availableBedIds, "bed", ctx)) continue;
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
 * Hide apartments that have a reserved/occupied child room or bed which is not
 * in the availability lists (e.g. still blocked for the inquiry dates).
 */
export function filterApartmentsWithoutReservedChildren(
  apartmentsRaw: unknown[],
  catalogRoomsRaw: unknown[],
  catalogBedsRaw: unknown[],
  availableRoomsRaw: unknown[],
  availableBedsRaw: unknown[],
  ctx: ChildBlockingContext = {
    roomById: new Map(),
    aptById: new Map(),
  },
): unknown[] {
  const availableRoomIds = indexRowIds(availableRoomsRaw);
  const availableBedIds = indexRowIds(availableBedsRaw);
  const roomToApt = roomIdToApartmentIdMap(catalogRoomsRaw);
  const blockedAptIds = new Set<string>();

  for (const room of catalogRoomsRaw) {
    if (!isChildBlockingParent(room, availableRoomIds, "room", ctx)) continue;
    const aptId = pickStr(
      room as Record<string, unknown>,
      "apartmentId",
      "ApartmentId",
    ).toLowerCase();
    if (aptId) blockedAptIds.add(aptId);
  }

  for (const bed of catalogBedsRaw) {
    if (!isChildBlockingParent(bed, availableBedIds, "bed", ctx)) continue;
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
  /** Unit types the user is searching for — parent hiding applies only to these. */
  searchKinds?: Array<"bed" | "room" | "apartment">;
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

function buildChildBlockingContext(
  input: AvailabilityHierarchyFilterInput,
): ChildBlockingContext {
  const catalogRooms = input.catalogRooms ?? [];
  const catalogBeds = input.catalogBeds ?? [];
  const roomById = catalogRowsById(catalogRooms);
  const aptById = catalogRowsById(input.apartments);

  for (const room of catalogRooms) {
    if (!room || typeof room !== "object") continue;
    const row = room as Record<string, unknown>;
    const roomId = rowIdKey(room);
    const aptId = pickStr(row, "apartmentId", "ApartmentId").toLowerCase();
    if (roomId && aptId && !aptById.has(aptId)) {
      const aptFromHierarchy = input.hierarchyRaw?.apartmentsRaw?.find(
        (item) => rowIdKey(item) === aptId,
      );
      if (aptFromHierarchy && typeof aptFromHierarchy === "object") {
        aptById.set(aptId, aptFromHierarchy as Record<string, unknown>);
      }
    }
  }

  for (const bed of catalogBeds) {
    if (!bed || typeof bed !== "object") continue;
    const row = bed as Record<string, unknown>;
    const roomId = pickStr(row, "roomId", "RoomId").toLowerCase();
    if (roomId && !roomById.has(roomId)) {
      const roomFromHierarchy = input.hierarchyRaw?.roomsRaw?.find(
        (item) => rowIdKey(item) === roomId,
      );
      if (roomFromHierarchy && typeof roomFromHierarchy === "object") {
        roomById.set(roomId, roomFromHierarchy as Record<string, unknown>);
      }
    }
  }

  return {
    inquiry: input.inquiry,
    occupancyIndex: input.occupancyIndex,
    roomById,
    aptById,
  };
}

/**
 * Wires apartment → room → bed hierarchy.
 *
 * - **Apartment search**: hides apartments with any blocked child room or bed.
 * - **Room search**: hides a room when it has a blocked child bed.
 * - **Bed search**: keeps available beds even when a sibling bed is blocked.
 *
 * When inquiry start is set, date occupancy is primarily handled by the API;
 * this layer uses catalog + occupancy index to avoid misleading parent cards.
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
  const hasCatalog = catalogBeds.length > 0 || catalogRooms.length > 0;
  const hasInquiry = Boolean(input.inquiry?.startDateYmd?.trim());

  const childBlockingCtx = buildChildBlockingContext(input);
  const searchKinds = new Set(input.searchKinds ?? []);
  const canEvaluateChildBlocking = hasCatalog || hasInquiry;
  const hideApartmentsWithBlockedChildren =
    canEvaluateChildBlocking &&
    (searchKinds.size === 0 || searchKinds.has("apartment"));
  const hideRoomsWithBlockedBeds =
    canEvaluateChildBlocking &&
    (searchKinds.size === 0 || searchKinds.has("room"));

  const bookableApartments = stripUnbookableUnitRows(
    input.apartments,
    input.inquiry,
    childBlockingCtx,
    "apartment",
  );
  const bookableRooms = stripUnbookableUnitRows(
    input.rooms,
    input.inquiry,
    childBlockingCtx,
    "room",
  );
  const bookableBeds = stripUnbookableUnitRows(
    input.beds,
    input.inquiry,
    childBlockingCtx,
    "bed",
  );

  const apartmentsForSearch = hideApartmentsWithBlockedChildren
    ? filterApartmentsWithoutReservedChildren(
        bookableApartments,
        catalogRooms,
        catalogBeds,
        bookableRooms,
        bookableBeds,
        childBlockingCtx,
      )
    : bookableApartments;

  // Room search: keep rooms from the API without requiring parent apartment in
  // Apartments/getAll (apartment cards are omitted when not searching apartments).
  const roomsBeforeChildFilter = searchKinds.has("room")
    ? bookableRooms
    : filterRoomsWithAvailableApartment(bookableRooms, input.apartments);

  const roomsForSearch = hideRoomsWithBlockedBeds
    ? filterRoomsWithoutReservedBeds(
        roomsBeforeChildFilter,
        catalogBeds,
        bookableBeds,
        childBlockingCtx,
      )
    : roomsBeforeChildFilter;

  // Bed search: API already returns free beds per leaf-level date filter.
  // Do not require parent room/apartment to appear in their getAll lists
  // (parents are hidden when siblings are reserved/occupied).
  const beds = searchKinds.has("bed")
    ? bookableBeds
    : filterBedsWithAvailableRoom(
        bookableBeds,
        filterRoomsWithAvailableApartment(bookableRooms, input.apartments),
      );

  return {
    apartments: apartmentsForSearch,
    rooms: roomsForSearch,
    beds,
  };
}
