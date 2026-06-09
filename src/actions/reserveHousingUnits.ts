"use server";

import {
  getApartmentById,
  updateApartmentById,
} from "@/actions/settings/apartmentService";
import { getBedById, updateBedById } from "@/actions/settings/bedService";
import { getRoomById, updateRoomById } from "@/actions/settings/roomService";
import { getRequestUnitsAll } from "@/actions/requestService";
import { getLookupArray } from "@/lib/availability-inquiry";
import { filterRowsByRequestId, parseRequestUnitFromApi } from "@/lib/housing-request-detail";
import type { AddRequestUnitDtoPayload } from "@/lib/housing-request-map";
import { parseRequestServiceError } from "@/lib/housing-request-map";
import {
  buildApartmentAvailableFormData,
  buildApartmentOccupiedFormData,
  buildApartmentReserveFormData,
  buildBedAvailableFormData,
  buildBedOccupiedFormData,
  buildBedReserveFormData,
  buildRoomAvailableFormData,
  buildRoomOccupiedFormData,
  buildRoomReserveFormData,
  unwrapUnitApiEntity,
} from "@/lib/unit-reserve-form";

type UnitReserveTarget =
  | { kind: "bed"; id: string }
  | { kind: "room"; id: string }
  | { kind: "apartment"; id: string };

function collectReserveTargets(
  units: AddRequestUnitDtoPayload[],
): UnitReserveTarget[] {
  const seen = new Set<string>();
  const targets: UnitReserveTarget[] = [];

  for (const unit of units) {
    const bedId = unit.bedId?.trim();
    const roomId = unit.roomId?.trim();
    const apartmentId = unit.apartmentId?.trim();

    if (bedId) {
      const key = `bed:${bedId}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ kind: "bed", id: bedId });
      }
      continue;
    }

    if (roomId) {
      const key = `room:${roomId}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ kind: "room", id: roomId });
      }
      continue;
    }

    if (apartmentId) {
      const key = `apartment:${apartmentId}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ kind: "apartment", id: apartmentId });
      }
    }
  }

  return targets;
}

function unitUpdateErrorMessage(res: unknown): string | null {
  if (res === null || res === undefined) {
    return "استجابة غير صالحة من الخادم.";
  }
  if (typeof res === "string") {
    return res.trim() ? null : "استجابة غير صالحة من الخادم.";
  }
  if (typeof res !== "object") return null;
  if ("error" in res && (res as { error?: string }).error) {
    return (
      (res as { message?: string }).message ||
      String((res as { error?: string }).error)
    );
  }
  return null;
}

async function reserveBed(id: string): Promise<string | null> {
  const loaded = await getBedById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات السرير.";
  }
  const res = await updateBedById(buildBedReserveFormData(api));
  return unitUpdateErrorMessage(res);
}

async function occupyBed(id: string): Promise<string | null> {
  const loaded = await getBedById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات السرير.";
  }
  const res = await updateBedById(buildBedOccupiedFormData(api));
  return unitUpdateErrorMessage(res);
}

async function reserveRoom(id: string): Promise<string | null> {
  const loaded = await getRoomById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الغرفة.";
  }
  const res = await updateRoomById(buildRoomReserveFormData(api));
  return unitUpdateErrorMessage(res);
}

async function occupyRoom(id: string): Promise<string | null> {
  const loaded = await getRoomById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الغرفة.";
  }
  const res = await updateRoomById(buildRoomOccupiedFormData(api));
  return unitUpdateErrorMessage(res);
}

async function reserveApartment(id: string): Promise<string | null> {
  const loaded = await getApartmentById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الشقة.";
  }
  const res = await updateApartmentById(buildApartmentReserveFormData(api));
  return unitUpdateErrorMessage(res);
}

async function occupyApartment(id: string): Promise<string | null> {
  const loaded = await getApartmentById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الشقة.";
  }
  const res = await updateApartmentById(buildApartmentOccupiedFormData(api));
  return unitUpdateErrorMessage(res);
}

async function releaseBed(id: string): Promise<string | null> {
  const loaded = await getBedById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات السرير.";
  }
  const res = await updateBedById(buildBedAvailableFormData(api));
  return unitUpdateErrorMessage(res);
}

async function releaseRoom(id: string): Promise<string | null> {
  const loaded = await getRoomById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الغرفة.";
  }
  const res = await updateRoomById(buildRoomAvailableFormData(api));
  return unitUpdateErrorMessage(res);
}

async function releaseApartment(id: string): Promise<string | null> {
  const loaded = await getApartmentById(id);
  const api = unwrapUnitApiEntity(loaded);
  if (!api) {
    return unitUpdateErrorMessage(loaded) ?? "تعذر تحميل بيانات الشقة.";
  }
  const res = await updateApartmentById(buildApartmentAvailableFormData(api));
  return unitUpdateErrorMessage(res);
}

async function applyUnitStatusToTargets(
  targets: UnitReserveTarget[],
  mode: "reserve" | "occupy" | "release",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const failures: string[] = [];

  for (const target of targets) {
    let err: string | null = null;
    if (target.kind === "bed") {
      err =
        mode === "reserve"
          ? await reserveBed(target.id)
          : mode === "occupy"
            ? await occupyBed(target.id)
            : await releaseBed(target.id);
    } else if (target.kind === "room") {
      err =
        mode === "reserve"
          ? await reserveRoom(target.id)
          : mode === "occupy"
            ? await occupyRoom(target.id)
            : await releaseRoom(target.id);
    } else {
      err =
        mode === "reserve"
          ? await reserveApartment(target.id)
          : mode === "occupy"
            ? await occupyApartment(target.id)
            : await releaseApartment(target.id);
    }

    if (err) {
      const label =
        target.kind === "bed"
          ? "سرير"
          : target.kind === "room"
            ? "غرفة"
            : "شقة";
      failures.push(`${label} (${target.id}): ${err}`);
    }
  }

  if (failures.length > 0) {
    const statusLabel =
      mode === "reserve"
        ? "محجوز"
        : mode === "occupy"
          ? "مشغول"
          : "متاح";
    return {
      ok: false,
      message: `تعذر تحديث حالة ${failures.length} وحدة إلى ${statusLabel}: ${failures.join("؛ ")}`,
    };
  }

  return { ok: true };
}

export async function loadRequestUnitsForRequest(
  requestId: string,
): Promise<
  | { ok: true; units: AddRequestUnitDtoPayload[] }
  | { ok: false; message: string }
> {
  const trimmed = requestId.trim();
  if (!trimmed) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }

  const unitsRes = await getRequestUnitsAll();
  const unitsError = parseRequestServiceError(unitsRes);
  if (unitsError) {
    return { ok: false, message: unitsError };
  }

  const units = filterRowsByRequestId(getLookupArray(unitsRes), trimmed)
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is AddRequestUnitDtoPayload => u != null);

  return { ok: true, units };
}

/**
 * After checkout or cancel, mark linked beds/rooms/apartments as Available.
 */
export async function releaseHousingUnitsForRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const loaded = await loadRequestUnitsForRequest(requestId);
  if (!loaded.ok) return loaded;

  const targets = collectReserveTargets(loaded.units);
  if (targets.length === 0) return { ok: true };

  return applyUnitStatusToTargets(targets, "release");
}

/**
 * After a housing request is approved, mark linked beds/rooms/apartments as Reserved.
 */
export async function reserveHousingUnitsForApproval(
  requestUnits: AddRequestUnitDtoPayload[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const targets = collectReserveTargets(requestUnits);
  if (targets.length === 0) {
    return { ok: true };
  }

  return applyUnitStatusToTargets(targets, "reserve");
}

/**
 * After check-in, mark linked beds/rooms/apartments as Occupied.
 */
export async function occupyHousingUnitsForRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const loaded = await loadRequestUnitsForRequest(requestId);
  if (!loaded.ok) return loaded;

  const targets = collectReserveTargets(loaded.units);
  if (targets.length === 0) return { ok: true };

  return applyUnitStatusToTargets(targets, "occupy");
}
