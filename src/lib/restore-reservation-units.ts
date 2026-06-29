import type { AvailableUnitType } from "@/actions/availabilityService";
import {
  availabilityCardKey,
  buildPreservedInquiryFieldsFromUnits,
  fetchMergedAvailabilityCards,
  type AvailabilityUnitCard,
  type ReservationStoredUnitSnapshot,
  toReservationStoredUnits,
  validateSelectedUnitsForInquiry,
} from "@/lib/availability-inquiry";
import { countNightsBetweenStartAndEnd } from "@/lib/housing-request-list";
import type { AddRequestUnitDtoPayload } from "@/lib/housing-request-map";
import {
  mapStoredUnitToRequestUnitDto,
  requestUnitDtosToEnrichedSnapshots,
} from "@/lib/housing-request-map";
import { normalizeUnitGender } from "@/lib/reservation-guest-unit-validation";
import { UNIT_STATUS_AVAILABLE } from "@/lib/unit-reserve-form";

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
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id").toLowerCase();
    if (id) map.set(id, r);
  }
  return map;
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
    Reserved: "2",
    Occupied: "3",
    متاح: UNIT_STATUS_AVAILABLE,
    محجوز: "2",
    مشغول: "3",
    متاحة: UNIT_STATUS_AVAILABLE,
    محجوزة: "2",
    مشغولة: "3",
  };
  return map[s] ?? s;
}

function isUnitRowStatusAvailable(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const status = normalizeCatalogUnitStatus(
    (row as Record<string, unknown>).status ??
      (row as Record<string, unknown>).Status,
  );
  return status === UNIT_STATUS_AVAILABLE;
}

function buildingNumbersEqual(a: string | undefined, b: string | undefined): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left || !right) return false;
  return left === right;
}

function gendersMatch(
  original: ReservationStoredUnitSnapshot,
  candidate: AvailabilityUnitCard,
): boolean {
  const og = normalizeUnitGender(original.genderType);
  const cg = normalizeUnitGender(candidate.genderType);
  if (!og) return true;
  if (!cg) return true;
  return og === cg;
}

function allocationTypesMatch(
  original: ReservationStoredUnitSnapshot,
  candidate: AvailabilityUnitCard,
): boolean {
  const og = original.allocationTypeLabel?.trim();
  if (!og) return true;
  const cg = candidate.allocationTypeLabel?.trim();
  if (!cg) return true;
  return og === cg;
}

function citiesMatch(
  original: ReservationStoredUnitSnapshot,
  candidate: AvailabilityUnitCard,
): boolean {
  const og = original.city?.trim();
  if (!og) return true;
  const cg = candidate.city?.trim();
  if (!cg) return true;
  return og === cg;
}

function roomTypeKeyFromRow(row: Record<string, unknown> | undefined): string {
  if (!row) return "";
  return (
    pickStr(row, "roomTypeId", "RoomTypeId") ||
    pickStr(row, "roomType", "RoomType")
  );
}

function roomTypesMatch(
  original: ReservationStoredUnitSnapshot,
  candidate: AvailabilityUnitCard,
  candidateKind: AvailableUnitType,
  roomsById: Map<string, Record<string, unknown>>,
): boolean {
  if (original.unitKind !== "room" || candidateKind !== "room") return true;
  const originalRow = roomsById.get(original.id.trim().toLowerCase());
  const originalKey = roomTypeKeyFromRow(originalRow);
  if (!originalKey) return true;
  const candidateRow = roomsById.get(candidate.id.trim().toLowerCase());
  const candidateKey = roomTypeKeyFromRow(candidateRow);
  if (!candidateKey) return true;
  return originalKey === candidateKey;
}

function specsMatch(
  original: ReservationStoredUnitSnapshot,
  candidate: AvailabilityUnitCard,
  candidateKind: AvailableUnitType,
  roomsById: Map<string, Record<string, unknown>>,
): boolean {
  if (!gendersMatch(original, candidate)) return false;
  if (!allocationTypesMatch(original, candidate)) return false;
  if (!citiesMatch(original, candidate)) return false;
  if (!roomTypesMatch(original, candidate, candidateKind, roomsById)) {
    return false;
  }
  return true;
}

function replacementKindsFor(originalKind: AvailableUnitType): AvailableUnitType[] {
  const kinds: AvailableUnitType[] = [originalKind];
  if (originalKind === "apartment") {
    kinds.push("room", "bed");
  } else if (originalKind === "room") {
    kinds.push("bed");
  }
  return kinds;
}

function pickFirstCandidate(
  candidates: AvailabilityUnitCard[],
): AvailabilityUnitCard | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) =>
    a.id.localeCompare(b.id, "ar"),
  );
  return sorted[0] ?? null;
}

function findReplacementCard(
  original: ReservationStoredUnitSnapshot,
  cards: AvailabilityUnitCard[],
  usedKeys: Set<string>,
  roomsById: Map<string, Record<string, unknown>>,
): AvailabilityUnitCard | null {
  const originalKey = availabilityCardKey(original);
  const building = original.buildingNumberAr?.trim();

  for (const kind of replacementKindsFor(original.unitKind)) {
    const pool = cards.filter(
      (card) =>
        card.unitKind === kind &&
        availabilityCardKey(card) !== originalKey &&
        !usedKeys.has(availabilityCardKey(card)) &&
        specsMatch(original, card, kind, roomsById),
    );

    if (pool.length === 0) continue;

    if (building) {
      const inBuilding = pool.filter((card) =>
        buildingNumbersEqual(card.buildingNumberAr, building),
      );
      if (inBuilding.length > 0) {
        const picked = pickFirstCandidate(inBuilding);
        if (picked) return picked;
      }
    }

    const picked = pickFirstCandidate(pool);
    if (picked) return picked;
  }

  return null;
}

function snapshotFromCard(card: AvailabilityUnitCard): ReservationStoredUnitSnapshot {
  return toReservationStoredUnits([card])[0]!;
}

export type ResolveRestoreReservationUnitsInput = {
  requestId: string;
  startDateYmd: string;
  endDateYmd: string;
  requestUnits: AddRequestUnitDtoPayload[];
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
};

export type ResolveRestoreReservationUnitsResult =
  | {
      ok: true;
      requestUnits: AddRequestUnitDtoPayload[];
      replacedUnits: boolean;
      replacementSummary?: string;
    }
  | { ok: false; message: string };

function preserveRequestUnitRowMeta(
  original: AddRequestUnitDtoPayload,
  resolved: AddRequestUnitDtoPayload,
): AddRequestUnitDtoPayload {
  return {
    ...(original.id ? { id: original.id } : {}),
    ...(original.code ? { code: original.code } : {}),
    requestId: original.requestId ?? resolved.requestId,
    ...resolved,
  };
}

/**
 * Ensures canceled-reservation units are catalog-available and bookable for the stay.
 * When a unit is not available, searches for a matching alternative (same specs);
 * smaller unit kinds prefer the same building when options exist there.
 */
export async function resolveRestoreReservationUnits(
  input: ResolveRestoreReservationUnitsInput,
): Promise<ResolveRestoreReservationUnitsResult> {
  const requestId = input.requestId.trim();
  const startDateYmd = input.startDateYmd.trim().slice(0, 10);
  const endDateYmd = input.endDateYmd.trim().slice(0, 10);

  if (!requestId) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateYmd)) {
    return { ok: false, message: "تاريخ بداية الحجز غير صالح." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateYmd)) {
    return { ok: false, message: "تاريخ نهاية الحجز غير صالح." };
  }

  const originals = input.requestUnits;
  if (originals.length === 0) {
    return { ok: true, requestUnits: [], replacedUnits: false };
  }

  const snapshots = requestUnitDtosToEnrichedSnapshots(
    originals,
    input.bedsRaw,
    input.roomsRaw,
    input.apartmentsRaw,
  );

  const nights = countNightsBetweenStartAndEnd(startDateYmd, endDateYmd);
  const preserved = buildPreservedInquiryFieldsFromUnits(snapshots);
  const inquiry = {
    startDateYmd,
    nights: Math.max(1, nights),
    genders: preserved.genders,
  };

  const bedsById = indexRowsById(input.bedsRaw);
  const roomsById = indexRowsById(input.roomsRaw);
  const apartmentsById = indexRowsById(input.apartmentsRaw);

  function catalogRowForSnapshot(
    unit: ReservationStoredUnitSnapshot,
  ): Record<string, unknown> | undefined {
    const id = unit.id.trim().toLowerCase();
    if (unit.unitKind === "bed") return bedsById.get(id);
    if (unit.unitKind === "room") return roomsById.get(id);
    return apartmentsById.get(id);
  }

  const dateValidation = await validateSelectedUnitsForInquiry({
    units: snapshots,
    inquiry,
    excludeRequestId: requestId,
  });

  const bookableKeys = new Set<string>();
  if (dateValidation.ok) {
    for (const unit of dateValidation.validatedUnits) {
      bookableKeys.add(availabilityCardKey(unit));
    }
  }

  const needsReplacement: ReservationStoredUnitSnapshot[] = [];
  for (const unit of snapshots) {
    const catalogRow = catalogRowForSnapshot(unit);
    const statusOk = catalogRow ? isUnitRowStatusAvailable(catalogRow) : false;
    const datesOk = bookableKeys.has(availabilityCardKey(unit));
    if (!statusOk || !datesOk) {
      needsReplacement.push(unit);
    }
  }

  if (needsReplacement.length === 0) {
    return {
      ok: true,
      requestUnits: originals,
      replacedUnits: false,
    };
  }

  const { cards, fatalError } = await fetchMergedAvailabilityCards(
    ["bed", "room", "apartment"],
    inquiry,
  );
  if (fatalError) {
    return { ok: false, message: fatalError };
  }

  const usedKeys = new Set<string>();
  const resolvedUnits: AddRequestUnitDtoPayload[] = [];
  const replacementLabels: string[] = [];
  let replacedUnits = false;

  for (let i = 0; i < snapshots.length; i += 1) {
    const snapshot = snapshots[i]!;
    const originalDto = originals[i]!;
    const key = availabilityCardKey(snapshot);
    const catalogRow = catalogRowForSnapshot(snapshot);
    const statusOk = catalogRow ? isUnitRowStatusAvailable(catalogRow) : false;
    const datesOk = bookableKeys.has(key);

    if (statusOk && datesOk) {
      usedKeys.add(key);
      resolvedUnits.push(originalDto);
      continue;
    }

    const replacementCard = findReplacementCard(
      snapshot,
      cards,
      usedKeys,
      roomsById,
    );
    if (!replacementCard) {
      return {
        ok: false,
        message: `لا توجد وحدة بديلة متاحة بنفس مواصفات «${snapshot.title}» للتواريخ المحددة.`,
      };
    }

    const replacementSnapshot = snapshotFromCard(replacementCard);
    const mapped = mapStoredUnitToRequestUnitDto(replacementSnapshot);
    if (!mapped.ok) {
      return { ok: false, message: mapped.message };
    }

    usedKeys.add(availabilityCardKey(replacementCard));
    resolvedUnits.push(
      preserveRequestUnitRowMeta(originalDto, {
        ...mapped.dto,
        requestId: originalDto.requestId ?? requestId,
      }),
    );
    replacedUnits = true;
    replacementLabels.push(
      `«${snapshot.title}» → «${replacementSnapshot.title}»`,
    );
  }

  const postValidation = await validateSelectedUnitsForInquiry({
    units: requestUnitDtosToEnrichedSnapshots(
      resolvedUnits,
      input.bedsRaw,
      input.roomsRaw,
      input.apartmentsRaw,
    ),
    inquiry,
    excludeRequestId: requestId,
  });
  if (!postValidation.ok) {
    return { ok: false, message: postValidation.message };
  }

  return {
    ok: true,
    requestUnits: resolvedUnits,
    replacedUnits,
    replacementSummary:
      replacementLabels.length > 0
        ? `تم استبدال الوحدات: ${replacementLabels.join("؛ ")}`
        : undefined,
  };
}
