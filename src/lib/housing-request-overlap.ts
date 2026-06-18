import {
  addDaysToYmd,
  extractNightsFromRequest,
  isExtensionRequestRecord,
  isRequestStatusApproved,
  isRequestStatusPending,
  parseRequestCatagoryApiValue,
  toYmd,
} from "@/lib/housing-request-list";
import { resolveRequestLinkedContentRequestId } from "@/lib/housing-request-detail";
import type { AddRequestUnitDtoPayload } from "@/lib/housing-request-map";

type UnitGranularity = "bed" | "room" | "apartment";

type UnitScope = {
  granularity: UnitGranularity;
  bedId?: string;
  roomId?: string;
  apartmentId?: string;
};

export type HousingRequestStayWindow = {
  requestId: string;
  startDate: string;
  endDate: string;
};

export type UnitHierarchyMaps = {
  bedRoomIds: Map<string, string>;
  roomApartmentIds: Map<string, string>;
};

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function indexRowsById(rows: unknown[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = pickStr(row, "id", "Id");
    if (id) map.set(id.toLowerCase(), row);
  }
  return map;
}

/** Builds bed→room and room→apartment maps from lookup tables. */
export function buildUnitHierarchyMaps(
  bedsRaw: unknown[],
  roomsRaw: unknown[],
): UnitHierarchyMaps {
  const bedRoomIds = new Map<string, string>();
  for (const item of bedsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const bedId = pickStr(row, "id", "Id");
    const roomId = pickStr(row, "roomId", "RoomId");
    if (bedId && roomId) bedRoomIds.set(bedId.toLowerCase(), roomId);
  }

  const roomApartmentIds = new Map<string, string>();
  for (const item of roomsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const roomId = pickStr(row, "id", "Id");
    const apartmentId = pickStr(row, "apartmentId", "ApartmentId");
    if (roomId && apartmentId) {
      roomApartmentIds.set(roomId.toLowerCase(), apartmentId);
    }
  }

  return { bedRoomIds, roomApartmentIds };
}

function resolveApartmentId(
  scope: UnitScope,
  maps: UnitHierarchyMaps,
): string | undefined {
  if (scope.apartmentId?.trim()) return scope.apartmentId.trim();
  const roomId = resolveRoomId(scope, maps);
  if (!roomId) return undefined;
  return maps.roomApartmentIds.get(roomId.toLowerCase());
}

function resolveRoomId(
  scope: UnitScope,
  maps: UnitHierarchyMaps,
): string | undefined {
  if (scope.roomId?.trim()) return scope.roomId.trim();
  const bedId = scope.bedId?.trim();
  if (!bedId) return undefined;
  return maps.bedRoomIds.get(bedId.toLowerCase());
}

function resolveUnitScope(
  unit: AddRequestUnitDtoPayload,
  maps: UnitHierarchyMaps,
): UnitScope {
  const bedId = unit.bedId?.trim();
  let roomId = unit.roomId?.trim();
  let apartmentId = unit.apartmentId?.trim();

  if (!roomId && bedId) {
    roomId = maps.bedRoomIds.get(bedId.toLowerCase());
  }
  if (!apartmentId && roomId) {
    apartmentId = maps.roomApartmentIds.get(roomId.toLowerCase());
  }

  if (bedId) {
    return { granularity: "bed", bedId, roomId, apartmentId };
  }
  if (roomId) {
    return { granularity: "room", roomId, apartmentId };
  }
  return { granularity: "apartment", apartmentId };
}

function scopesSameUnit(left: UnitScope, right: UnitScope): boolean {
  if (left.granularity === "bed" && right.granularity === "bed") {
    return Boolean(
      left.bedId &&
        right.bedId &&
        left.bedId.toLowerCase() === right.bedId.toLowerCase(),
    );
  }
  if (left.granularity === "room" && right.granularity === "room") {
    return Boolean(
      left.roomId &&
        right.roomId &&
        left.roomId.toLowerCase() === right.roomId.toLowerCase(),
    );
  }
  if (left.granularity === "apartment" && right.granularity === "apartment") {
    return Boolean(
      left.apartmentId &&
        right.apartmentId &&
        left.apartmentId.toLowerCase() === right.apartmentId.toLowerCase(),
    );
  }
  return false;
}

/** True when `descendant` is the same unit or nested under `ancestor` (apartment ⊃ room ⊃ bed). */
function isDescendantScope(
  ancestor: UnitScope,
  descendant: UnitScope,
  maps: UnitHierarchyMaps,
): boolean {
  switch (ancestor.granularity) {
    case "apartment": {
      const ancestorApt = ancestor.apartmentId?.trim().toLowerCase();
      if (!ancestorApt) return false;
      const descendantApt = resolveApartmentId(descendant, maps)?.toLowerCase();
      return Boolean(descendantApt && descendantApt === ancestorApt);
    }
    case "room": {
      const ancestorRoom = ancestor.roomId?.trim().toLowerCase();
      if (!ancestorRoom) return false;
      const descendantRoom = resolveRoomId(descendant, maps)?.toLowerCase();
      return Boolean(descendantRoom && descendantRoom === ancestorRoom);
    }
    case "bed": {
      if (descendant.granularity !== "bed") return false;
      return Boolean(
        ancestor.bedId &&
          descendant.bedId &&
          ancestor.bedId.toLowerCase() === descendant.bedId.toLowerCase(),
      );
    }
    default:
      return false;
  }
}

function unitScopesHierarchicallyConflict(
  left: UnitScope,
  right: UnitScope,
  maps: UnitHierarchyMaps,
): boolean {
  if (scopesSameUnit(left, right)) return true;
  return (
    isDescendantScope(left, right, maps) || isDescendantScope(right, left, maps)
  );
}

/** Mirrors backend `RequestUnitsOverlap` in `RequestService`. */
export function requestUnitsOverlap(
  leftUnits: AddRequestUnitDtoPayload[],
  rightUnits: AddRequestUnitDtoPayload[],
  maps: UnitHierarchyMaps,
): boolean {
  for (const left of leftUnits) {
    const leftScope = resolveUnitScope(left, maps);
    for (const right of rightUnits) {
      const rightScope = resolveUnitScope(right, maps);
      if (unitScopesHierarchicallyConflict(leftScope, rightScope, maps)) {
        return true;
      }
    }
  }
  return false;
}

/** Lists pending unit indexes that sit under an approved parent unit (for UI hints). */
export function findPendingUnitsUnderApprovedParents(
  pendingUnits: AddRequestUnitDtoPayload[],
  approvedUnits: AddRequestUnitDtoPayload[],
  maps: UnitHierarchyMaps,
): number[] {
  const conflictIndexes = new Set<number>();

  for (let i = 0; i < pendingUnits.length; i += 1) {
    const pendingScope = resolveUnitScope(pendingUnits[i], maps);
    for (const approved of approvedUnits) {
      const approvedScope = resolveUnitScope(approved, maps);
      if (
        unitScopesHierarchicallyConflict(approvedScope, pendingScope, maps)
      ) {
        conflictIndexes.add(i);
        break;
      }
    }
  }

  return [...conflictIndexes].sort((a, b) => a - b);
}

/** True when two stay windows share at least one night (exclusive end date). */
export function requestDateRangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  const aStart = leftStart.trim().slice(0, 10);
  const aEnd = leftEnd.trim().slice(0, 10);
  const bStart = rightStart.trim().slice(0, 10);
  const bEnd = rightEnd.trim().slice(0, 10);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function extractRequestStayWindow(
  raw: Record<string, unknown>,
): HousingRequestStayWindow | null {
  const requestId = pickStr(raw, "id", "Id");
  const startDate = toYmd(raw.startDate ?? raw.StartDate);
  if (!requestId || !startDate) return null;

  let endDate = toYmd(raw.endDate ?? raw.EndDate);
  if (!endDate) {
    const nights = extractNightsFromRequest(raw);
    if (nights > 0) {
      endDate = addDaysToYmd(startDate, nights);
    }
  }
  if (!endDate) return null;
  return { requestId, startDate, endDate };
}

function maxYmd(left: string, right: string): string {
  return left >= right ? left : right;
}

export function buildPreviousRequestIdMap(
  requestItems: unknown[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of requestItems) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = pickStr(raw, "id", "Id");
    const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
    if (id && previousId) {
      map.set(id.toLowerCase(), previousId.toLowerCase());
    }
  }
  return map;
}

/** Walks `PreviousRequestId` chain to the original stay (matches availability occupancy). */
export function resolveRootStayRequestId(
  requestId: string,
  previousById: Map<string, string>,
): string {
  let current = requestId.trim().toLowerCase();
  const visited = new Set<string>();
  while (previousById.has(current)) {
    if (visited.has(current)) break;
    visited.add(current);
    current = previousById.get(current)!;
  }
  return current;
}

/**
 * Approved stay windows for overlap checks.
 * Extension rows use root-stay start through merged end (units block the full span).
 */
export function buildApprovedStayWindowsForOverlap(
  requestItems: unknown[],
  options?: {
    extensionsRaw?: unknown[];
    reservationsRaw?: unknown[];
  },
): HousingRequestStayWindow[] {
  const previousById = buildPreviousRequestIdMap(requestItems);
  const requestById = new Map<string, Record<string, unknown>>();
  const windowsById = new Map<string, HousingRequestStayWindow>();

  for (const item of requestItems) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = pickStr(raw, "id", "Id");
    if (id) requestById.set(id.toLowerCase(), raw);
    const window = extractRequestStayWindow(raw);
    if (window) {
      windowsById.set(window.requestId.toLowerCase(), window);
    }
  }

  const approved: Array<{
    raw: Record<string, unknown>;
    window: HousingRequestStayWindow;
  }> = [];

  for (const item of requestItems) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (!isApprovedRequestStatus(raw.status ?? raw.Status)) continue;
    const window = extractRequestStayWindow(raw);
    if (!window) continue;
    approved.push({ raw, window });
  }

  const mergedEndByRoot = new Map<string, string>();
  for (const { window } of approved) {
    mergedEndByRoot.set(window.requestId.toLowerCase(), window.endDate);
  }
  for (const { raw, window } of approved) {
    if (!isExtensionRequestRecord(raw)) continue;
    const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
    if (!previousId) continue;
    const rootKey = resolveRootStayRequestId(previousId, previousById);
    const existing = mergedEndByRoot.get(rootKey);
    mergedEndByRoot.set(
      rootKey,
      existing ? maxYmd(existing, window.endDate) : window.endDate,
    );
  }

  const requestIdByReservationId = new Map<string, string>();
  for (const item of options?.reservationsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const reservation = item as Record<string, unknown>;
    const requestId = pickStr(reservation, "requestId", "RequestId");
    const reservationId = pickStr(reservation, "id", "Id");
    if (requestId && reservationId) {
      requestIdByReservationId.set(
        reservationId.toLowerCase(),
        requestId.toLowerCase(),
      );
    }
  }

  for (const item of options?.extensionsRaw ?? []) {
    if (!item || typeof item !== "object") continue;
    const ext = item as Record<string, unknown>;
    if (!isApprovedRequestStatus(ext.status ?? ext.Status)) continue;
    const reservationId = pickStr(ext, "reservationId", "ReservationId");
    const endYmd = toYmd(ext.endDate ?? ext.EndDate);
    if (!reservationId || !endYmd) continue;
    const requestId = requestIdByReservationId.get(reservationId.toLowerCase());
    if (!requestId) continue;
    const rootKey = resolveRootStayRequestId(requestId, previousById);
    const existing = mergedEndByRoot.get(rootKey);
    mergedEndByRoot.set(rootKey, existing ? maxYmd(existing, endYmd) : endYmd);
  }

  const resultsById = new Map<string, HousingRequestStayWindow>();

  for (const { raw, window } of approved) {
    const key = window.requestId.toLowerCase();
    if (isExtensionRequestRecord(raw)) {
      const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
      const rootKey = previousId
        ? resolveRootStayRequestId(previousId, previousById)
        : key;
      const rootWindow = windowsById.get(rootKey);
      resultsById.set(key, {
        requestId: window.requestId,
        startDate: rootWindow?.startDate ?? window.startDate,
        endDate: mergedEndByRoot.get(rootKey) ?? window.endDate,
      });
      continue;
    }

    resultsById.set(key, {
      requestId: window.requestId,
      startDate: window.startDate,
      endDate: mergedEndByRoot.get(key) ?? window.endDate,
    });
  }

  for (const [rootKey, endDate] of mergedEndByRoot.entries()) {
    const rootWindow = windowsById.get(rootKey);
    if (!rootWindow) continue;
    const existing = resultsById.get(rootKey);
    if (existing) {
      resultsById.set(rootKey, {
        ...existing,
        endDate: maxYmd(existing.endDate, endDate),
      });
      continue;
    }
    const rootRaw = requestById.get(rootKey);
    if (!rootRaw || !isApprovedRequestStatus(rootRaw.status ?? rootRaw.Status)) {
      continue;
    }
    resultsById.set(rootKey, {
      requestId: rootWindow.requestId,
      startDate: rootWindow.startDate,
      endDate,
    });
  }

  for (const { raw, window } of approved) {
    if (!isExtensionRequestRecord(raw)) continue;
    const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
    if (!previousId) continue;
    const rootKey = resolveRootStayRequestId(previousId, previousById);
    const rootWindow = windowsById.get(rootKey);
    if (!rootWindow) continue;
    const effectiveEnd = mergedEndByRoot.get(rootKey) ?? window.endDate;
    if (!resultsById.has(rootKey)) {
      resultsById.set(rootKey, {
        requestId: rootWindow.requestId,
        startDate: rootWindow.startDate,
        endDate: effectiveEnd,
      });
    }
  }

  return [...resultsById.values()];
}

function resolveApprovedUnitsForOverlap(
  approvedStayId: string,
  requestById: Map<string, Record<string, unknown>>,
  previousById: Map<string, string>,
  unitsByRequestId: Map<string, AddRequestUnitDtoPayload[]>,
): AddRequestUnitDtoPayload[] {
  const key = approvedStayId.toLowerCase();
  const raw = requestById.get(key);

  if (raw && isExtensionRequestRecord(raw)) {
    const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
    if (previousId) {
      const rootKey = resolveRootStayRequestId(previousId, previousById);
      const rootUnits = unitsByRequestId.get(rootKey) ?? [];
      if (rootUnits.length > 0) return rootUnits;
    }
  }

  return unitsByRequestId.get(key) ?? [];
}

export function isFlexibleAllocationLabel(label: string): boolean {
  const normalized = label.trim();
  return normalized === "مرن" || normalized === "متحرك";
}

export function isApprovedRequestStatus(value: unknown): boolean {
  return isRequestStatusApproved(value);
}

export function isFlexibleAllocationValue(value: unknown): boolean {
  if (value === 2 || value === "2") return true;
  const text = String(value ?? "").trim().toLowerCase();
  return (
    text.includes("flex") ||
    text.includes("movable") ||
    text === "مرن" ||
    text === "متحرك"
  );
}

/**
 * Extension requests store units on `PreviousRequestId`, not on the extension row.
 * Copy linked units onto each extension request id for overlap checks.
 */
export function aliasExtensionUnitsOnRequestMap(
  requestItems: unknown[],
  unitsByRequestId: Map<string, AddRequestUnitDtoPayload[]>,
): Map<string, AddRequestUnitDtoPayload[]> {
  const result = new Map(unitsByRequestId);
  const previousById = buildPreviousRequestIdMap(requestItems);

  for (const item of requestItems) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const requestId = pickStr(raw, "id", "Id");
    if (!requestId) continue;
    if (!isExtensionRequestRecord(raw)) continue;

    const previousId = pickStr(raw, "previousRequestId", "PreviousRequestId");
    const linkedKey = previousId
      ? resolveRootStayRequestId(previousId, previousById)
      : resolveRequestLinkedContentRequestId(raw, requestId).toLowerCase();
    const requestKey = requestId.toLowerCase();
    if (!linkedKey || linkedKey === requestKey) continue;

    const ownUnits = result.get(requestKey) ?? [];
    if (ownUnits.length > 0) continue;

    const linkedUnits = result.get(linkedKey);
    if (linkedUnits?.length) {
      result.set(requestKey, linkedUnits);
    }
  }

  return result;
}

export function buildOverlapUnitsByRequestId(
  requestItems: unknown[],
  requestUnitsRaw: unknown[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  parseUnit: (
    raw: Record<string, unknown>,
  ) => AddRequestUnitDtoPayload | null,
): Map<string, AddRequestUnitDtoPayload[]> {
  const enriched = enrichUnitsByRequestIdFromHierarchy(
    buildUnitsByRequestId(requestUnitsRaw, parseUnit),
    bedsRaw,
    roomsRaw,
  );
  return aliasExtensionUnitsOnRequestMap(requestItems, enriched);
}

/**
 * Returns pending request ids that overlap in dates and units with
 * at least one approved request (includes approved extension stays).
 */
export function findPendingUnitOverlaps(input: {
  pending: HousingRequestStayWindow[];
  approved: HousingRequestStayWindow[];
  unitsByRequestId: Map<string, AddRequestUnitDtoPayload[]>;
  maps: UnitHierarchyMaps;
  requestItems?: unknown[];
  /** When set, only these pending ids are considered (e.g. flexible-only). */
  pendingRequestIds?: Set<string>;
}): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  const pendingFilter = input.pendingRequestIds;
  const previousById = buildPreviousRequestIdMap(input.requestItems ?? []);
  const requestById = new Map<string, Record<string, unknown>>();
  for (const item of input.requestItems ?? []) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = pickStr(raw, "id", "Id");
    if (id) requestById.set(id.toLowerCase(), raw);
  }

  for (const pendingStay of input.pending) {
    if (
      pendingFilter &&
      !pendingFilter.has(pendingStay.requestId) &&
      !pendingFilter.has(pendingStay.requestId.toLowerCase())
    ) {
      continue;
    }

    const pendingUnits =
      input.unitsByRequestId.get(pendingStay.requestId.toLowerCase()) ?? [];
    if (pendingUnits.length === 0) continue;

    const approvedConflictIds: string[] = [];
    for (const approvedStay of input.approved) {
      if (
        approvedStay.requestId.toLowerCase() ===
        pendingStay.requestId.toLowerCase()
      ) {
        continue;
      }
      if (
        !requestDateRangesOverlap(
          pendingStay.startDate,
          pendingStay.endDate,
          approvedStay.startDate,
          approvedStay.endDate,
        )
      ) {
        continue;
      }

      const approvedUnits = resolveApprovedUnitsForOverlap(
        approvedStay.requestId,
        requestById,
        previousById,
        input.unitsByRequestId,
      );
      if (approvedUnits.length === 0) continue;

      if (requestUnitsOverlap(pendingUnits, approvedUnits, input.maps)) {
        approvedConflictIds.push(approvedStay.requestId);
      }
    }

    if (approvedConflictIds.length > 0) {
      conflicts.set(pendingStay.requestId.toLowerCase(), approvedConflictIds);
    }
  }

  return conflicts;
}

/**
 * @deprecated Use `findPendingUnitOverlaps` with `pendingRequestIds` filter.
 */
export function findFlexiblePendingUnitOverlaps(input: {
  pending: HousingRequestStayWindow[];
  pendingAllocationById: Map<string, boolean>;
  approved: HousingRequestStayWindow[];
  unitsByRequestId: Map<string, AddRequestUnitDtoPayload[]>;
  maps: UnitHierarchyMaps;
}): Map<string, string[]> {
  const flexiblePendingIds = new Set<string>();
  for (const stay of input.pending) {
    if (input.pendingAllocationById.get(stay.requestId)) {
      flexiblePendingIds.add(stay.requestId);
    }
  }
  return findPendingUnitOverlaps({
    pending: input.pending,
    approved: input.approved,
    unitsByRequestId: input.unitsByRequestId,
    maps: input.maps,
    pendingRequestIds: flexiblePendingIds,
  });
}

export function buildUnitsByRequestId(
  requestUnitsRaw: unknown[],
  parseUnit: (
    raw: Record<string, unknown>,
  ) => AddRequestUnitDtoPayload | null,
): Map<string, AddRequestUnitDtoPayload[]> {
  const map = new Map<string, AddRequestUnitDtoPayload[]>();
  for (const item of requestUnitsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const deleted = row.isDeleted ?? row.IsDeleted;
    if (deleted === true || deleted === "true" || deleted === 1 || deleted === "1") {
      continue;
    }
    const requestId = pickStr(row, "requestId", "RequestId");
    if (!requestId) continue;
    const unit = parseUnit(row);
    if (!unit) continue;
    const key = requestId.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(unit);
    map.set(key, list);
  }
  return map;
}

export function enrichUnitsByRequestIdFromHierarchy(
  unitsByRequestId: Map<string, AddRequestUnitDtoPayload[]>,
  bedsRaw: unknown[],
  roomsRaw: unknown[],
): Map<string, AddRequestUnitDtoPayload[]> {
  const bedById = indexRowsById(bedsRaw);
  const roomById = indexRowsById(roomsRaw);
  const enriched = new Map<string, AddRequestUnitDtoPayload[]>();

  for (const [requestId, units] of unitsByRequestId.entries()) {
    enriched.set(
      requestId,
      units.map((unit) => {
        const next = { ...unit };
        let apartmentId = next.apartmentId?.trim();
        const bedId = next.bedId?.trim();
        let roomId = next.roomId?.trim();

        if (!roomId && bedId) {
          const bed = bedById.get(bedId.toLowerCase());
          if (bed) {
            roomId = pickStr(bed, "roomId", "RoomId") || roomId;
            next.roomId = roomId;
          }
        }
        if (!apartmentId && roomId) {
          const room = roomById.get(roomId.toLowerCase());
          if (room) {
            apartmentId = pickStr(room, "apartmentId", "ApartmentId");
            if (apartmentId) next.apartmentId = apartmentId;
          }
        }
        return next;
      }),
    );
  }

  return enriched;
}

export const HOUSING_REQUEST_OVERLAP_APPROVE_MESSAGE =
  "يوجد تداخل في التواريخ والوحدات مع طلب موافق عليه. عدّل وحدات الطلب المرن قبل الموافقة.";
