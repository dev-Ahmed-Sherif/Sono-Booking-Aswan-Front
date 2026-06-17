"use server";

import { getApartmentById } from "@/actions/settings/apartmentService";
import { getBedById, getBeds } from "@/actions/settings/bedService";
import { getRoomById, getRooms } from "@/actions/settings/roomService";
import { getLookupArray } from "@/lib/availability-inquiry";
import { extractApiEntity } from "@/lib/housing-request-detail";

export type RequestUnitRef = {
  bedId?: string | null;
  roomId?: string | null;
  apartmentId?: string | null;
};

function pickId(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function rowsFromServiceResponse(res: unknown): Record<string, unknown>[] {
  if (!res || typeof res !== "object") return [];
  if ((res as { error?: string }).error) return [];
  const data = (res as { data?: unknown }).data ?? res;
  return getLookupArray(data).filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object",
  );
}

/**
 * Loads bed/room/apartment rows by id for saved request units.
 * Unlike availability search, this works for occupied/completed units.
 * Room/apartment selections include child beds (and rooms) for capacity validation.
 */
export async function fetchRequestUnitHierarchyRows(units: RequestUnitRef[]) {
  const bedsMap = new Map<string, Record<string, unknown>>();
  const roomsMap = new Map<string, Record<string, unknown>>();
  const apartmentsMap = new Map<string, Record<string, unknown>>();
  const roomsWithBedsLoaded = new Set<string>();
  const apartmentsWithChildrenLoaded = new Set<string>();

  async function ensureApartment(id: string) {
    const key = id.toLowerCase();
    if (!apartmentsMap.has(key)) {
      const row = extractApiEntity(await getApartmentById(id));
      if (row) apartmentsMap.set(key, row);
    }
    await ensureApartmentChildren(id);
  }

  async function ensureRoomBeds(roomId: string) {
    const key = roomId.toLowerCase();
    if (roomsWithBedsLoaded.has(key)) return;
    roomsWithBedsLoaded.add(key);

    const res = await getBeds(roomId, { allStatuses: true });
    for (const row of rowsFromServiceResponse(res)) {
      const bedId = pickId(row, "id", "Id");
      if (bedId) bedsMap.set(bedId.toLowerCase(), row);
    }
  }

  async function ensureApartmentChildren(apartmentId: string) {
    const key = apartmentId.toLowerCase();
    if (apartmentsWithChildrenLoaded.has(key)) return;
    apartmentsWithChildrenLoaded.add(key);

    const res = await getRooms(apartmentId, { allStatuses: true });
    for (const row of rowsFromServiceResponse(res)) {
      const roomId = pickId(row, "id", "Id");
      if (!roomId) continue;
      const roomKey = roomId.toLowerCase();
      if (!roomsMap.has(roomKey)) roomsMap.set(roomKey, row);
      await ensureRoomBeds(roomId);
    }
  }

  async function ensureRoom(id: string) {
    const key = id.toLowerCase();
    if (!roomsMap.has(key)) {
      const row = extractApiEntity(await getRoomById(id));
      if (row) {
        roomsMap.set(key, row);
        const apartmentId = pickId(row, "apartmentId", "ApartmentId");
        if (apartmentId) await ensureApartment(apartmentId);
      }
    }
    await ensureRoomBeds(id);
  }

  async function ensureBed(id: string) {
    const key = id.toLowerCase();
    if (bedsMap.has(key)) return;
    const row = extractApiEntity(await getBedById(id));
    if (row) {
      bedsMap.set(key, row);
      const roomId = pickId(row, "roomId", "RoomId");
      if (roomId) await ensureRoom(roomId);
    }
  }

  for (const unit of units) {
    const bedId = unit.bedId?.trim();
    const roomId = unit.roomId?.trim();
    const apartmentId = unit.apartmentId?.trim();

    if (bedId) await ensureBed(bedId);
    else if (roomId) await ensureRoom(roomId);
    else if (apartmentId) await ensureApartment(apartmentId);
  }

  return {
    bedsRaw: [...bedsMap.values()],
    roomsRaw: [...roomsMap.values()],
    apartmentsRaw: [...apartmentsMap.values()],
  };
}
