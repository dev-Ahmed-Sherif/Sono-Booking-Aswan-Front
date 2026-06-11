"use server";

import { getApartmentById } from "@/actions/settings/apartmentService";
import { getBedById } from "@/actions/settings/bedService";
import { getRoomById } from "@/actions/settings/roomService";
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

/**
 * Loads bed/room/apartment rows by id for saved request units.
 * Unlike availability search, this works for occupied/completed units.
 */
export async function fetchRequestUnitHierarchyRows(units: RequestUnitRef[]) {
  const bedsMap = new Map<string, Record<string, unknown>>();
  const roomsMap = new Map<string, Record<string, unknown>>();
  const apartmentsMap = new Map<string, Record<string, unknown>>();

  async function ensureApartment(id: string) {
    const key = id.toLowerCase();
    if (apartmentsMap.has(key)) return;
    const row = extractApiEntity(await getApartmentById(id));
    if (row) apartmentsMap.set(key, row);
  }

  async function ensureRoom(id: string) {
    const key = id.toLowerCase();
    if (roomsMap.has(key)) return;
    const row = extractApiEntity(await getRoomById(id));
    if (row) {
      roomsMap.set(key, row);
      const apartmentId = pickId(row, "apartmentId", "ApartmentId");
      if (apartmentId) await ensureApartment(apartmentId);
    }
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
