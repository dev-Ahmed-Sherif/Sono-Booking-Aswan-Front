function pickStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickCount(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || value === "") continue;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return undefined;
}

export type ApartmentUnitCounts = {
  roomsCountByApartmentId: Map<string, number>;
  bedsCountByApartmentId: Map<string, number>;
};

/** Aggregate room/bed rows into per-apartment totals (ids compared case-insensitively). */
export function buildApartmentUnitCounts(
  rooms: Record<string, unknown>[],
  beds: Record<string, unknown>[],
): ApartmentUnitCounts {
  const roomApartmentById = new Map<string, string>();
  const roomsCountByApartmentId = new Map<string, number>();

  for (const room of rooms) {
    const apartmentId = pickStr(room, "apartmentId", "ApartmentId").toLowerCase();
    if (!apartmentId) continue;
    roomsCountByApartmentId.set(
      apartmentId,
      (roomsCountByApartmentId.get(apartmentId) ?? 0) + 1,
    );
    const roomId = pickStr(room, "id", "Id").toLowerCase();
    if (roomId) roomApartmentById.set(roomId, apartmentId);
  }

  const bedsCountByApartmentId = new Map<string, number>();
  for (const bed of beds) {
    const roomId = pickStr(bed, "roomId", "RoomId").toLowerCase();
    const apartmentId = roomApartmentById.get(roomId);
    if (!apartmentId) continue;
    bedsCountByApartmentId.set(
      apartmentId,
      (bedsCountByApartmentId.get(apartmentId) ?? 0) + 1,
    );
  }

  return { roomsCountByApartmentId, bedsCountByApartmentId };
}

/** Aggregate bed rows into per-room totals (ids compared case-insensitively). */
export function buildRoomBedCounts(
  beds: Record<string, unknown>[],
): Map<string, number> {
  const bedsCountByRoomId = new Map<string, number>();
  for (const bed of beds) {
    const roomId = pickStr(bed, "roomId", "RoomId").toLowerCase();
    if (!roomId) continue;
    bedsCountByRoomId.set(
      roomId,
      (bedsCountByRoomId.get(roomId) ?? 0) + 1,
    );
  }
  return bedsCountByRoomId;
}

export function resolveRoomBedCount(
  room: Record<string, unknown>,
  bedsCountByRoomId: Map<string, number>,
): number {
  const fromApi = pickCount(room, [
    "bedsCount",
    "BedsCount",
    "noOfBeds",
    "NoOfBeds",
  ]);
  if (fromApi !== undefined) return fromApi;
  const roomId = pickStr(room, "id", "Id").toLowerCase();
  return roomId ? bedsCountByRoomId.get(roomId) ?? 0 : 0;
}

export function resolveApartmentUnitCounts(
  apartment: Record<string, unknown>,
  counts: ApartmentUnitCounts,
): { roomsCount: number; bedsCount: number } {
  const apartmentId = pickStr(apartment, "id", "Id").toLowerCase();
  const roomsFromApi = pickCount(apartment, [
    "roomsCount",
    "RoomsCount",
    "noOfRooms",
    "NoOfRooms",
  ]);
  const bedsFromApi = pickCount(apartment, [
    "bedsCount",
    "BedsCount",
    "noOfBeds",
    "NoOfBeds",
  ]);

  return {
    roomsCount:
      roomsFromApi ??
      (apartmentId ? counts.roomsCountByApartmentId.get(apartmentId) ?? 0 : 0),
    bedsCount:
      bedsFromApi ??
      (apartmentId ? counts.bedsCountByApartmentId.get(apartmentId) ?? 0 : 0),
  };
}

export function rowsFromServiceList(res: unknown): Record<string, unknown>[] {
  if (!res || typeof res !== "object") return [];
  if ((res as { error?: string }).error) return [];
  const raw = (res as { data?: unknown }).data ?? res;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === "object",
  );
}
