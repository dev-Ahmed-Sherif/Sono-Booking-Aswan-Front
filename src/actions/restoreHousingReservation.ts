"use server";

import { loadReservationForMutation } from "@/actions/housingReservationMutation";
import {
  loadRequestUnitsForRequest,
  reserveHousingUnitsForRequest,
} from "@/actions/reserveHousingUnits";
import { getApartments } from "@/actions/settings/apartmentService";
import { getBeds } from "@/actions/settings/bedService";
import { getRooms } from "@/actions/settings/roomService";
import {
  getRequestById,
  getRequestParticipantsAll,
  updateRequestById,
} from "@/actions/requestService";
import { updateReservationById } from "@/actions/reservationService";
import { getLookupArray } from "@/lib/availability-inquiry";
import {
  buildUpdateRequestPayload,
  extractApiEntity,
  extractCompanionIdsFromParticipantRows,
  parseRequestDetail,
  resolveParticipantRowsForRequest,
} from "@/lib/housing-request-detail";
import {
  isRequestServiceSuccess,
  parseRequestServiceError,
} from "@/lib/housing-request-map";
import {
  RESERVATION_STATUS_RESERVED,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";
import { resolveRestoreReservationUnits } from "@/lib/restore-reservation-units";

export type RestoreHousingReservationInput = {
  id: string;
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
};

export type RestoreHousingReservationResult =
  | {
      ok: true;
      unitReserveWarning?: string;
      unitReplacementWarning?: string;
    }
  | { ok: false; message: string };

/**
 * Restores a canceled reservation: re-validates units (available or same-spec substitutes),
 * syncs request units when replacements are needed, updates reservation to Reserved, then
 * marks units Reserved.
 */
export async function restoreHousingReservation(
  input: RestoreHousingReservationInput,
): Promise<RestoreHousingReservationResult> {
  const loaded = await loadReservationForMutation(input.id, input);
  if (!loaded.ok) return loaded;

  const { reservation } = loaded;
  const requestId =
    reservation.requestId?.trim() || input.requestId?.trim();
  if (!requestId) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }

  const startDateYmd =
    reservation.startDate?.trim().slice(0, 10) ||
    input.startDateYmd?.trim().slice(0, 10) ||
    "";
  const endDateYmd =
    reservation.endDate?.trim().slice(0, 10) ||
    input.endDateYmd?.trim().slice(0, 10) ||
    "";

  const unitsLoaded = await loadRequestUnitsForRequest(requestId);
  if (!unitsLoaded.ok) return unitsLoaded;

  const [bedsRes, roomsRes, apartmentsRes] = await Promise.all([
    getBeds(undefined, { allStatuses: true }),
    getRooms(undefined, { allStatuses: true }),
    getApartments(),
  ]);

  const bedsRaw = getLookupArray(bedsRes);
  const roomsRaw = getLookupArray(roomsRes);
  const apartmentsRaw = getLookupArray(apartmentsRes);

  const resolvedUnits = await resolveRestoreReservationUnits({
    requestId,
    startDateYmd,
    endDateYmd,
    requestUnits: unitsLoaded.units,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  });
  if (!resolvedUnits.ok) return resolvedUnits;

  if (resolvedUnits.replacedUnits) {
    const reqRes = await getRequestById(requestId);
    const raw = extractApiEntity(reqRes);
    if (!raw) {
      return {
        ok: false,
        message:
          parseRequestServiceError(reqRes) ?? "تعذر تحميل بيانات الطلب لتحديث الوحدات.",
      };
    }

    const detail = parseRequestDetail(raw, "");
    if (!detail) {
      return { ok: false, message: "بيانات الطلب غير صالحة." };
    }

    const ownerUserId = String(
      raw.userId ?? raw.UserId ?? raw.createdById ?? raw.CreatedById ?? "",
    ).trim();
    const partsRes = ownerUserId
      ? await getRequestParticipantsAll(ownerUserId)
      : await getRequestParticipantsAll();
    const participantRows = resolveParticipantRowsForRequest(
      raw,
      partsRes,
      requestId,
      reqRes,
    );
    const companionIds = extractCompanionIdsFromParticipantRows(participantRows);

    const requestUpdateRes = await updateRequestById(
      buildUpdateRequestPayload(
        detail,
        resolvedUnits.requestUnits,
        companionIds,
      ),
    );
    if (!isRequestServiceSuccess(requestUpdateRes)) {
      return {
        ok: false,
        message:
          parseRequestServiceError(requestUpdateRes) ??
          "تعذر تحديث وحدات الطلب قبل إعادة الحجز.",
      };
    }
  }

  const res = await updateReservationById(
    serializeAddReservationDtoForApi({
      id: reservation.id,
      requestId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      status: RESERVATION_STATUS_RESERVED,
      totalAmount: reservation.totalAmount,
      checkInDate: reservation.checkInDate,
      actualCheckOutDate: null,
      cancelationReason: "",
    }),
  );

  if (!isRequestServiceSuccess(res)) {
    return {
      ok: false,
      message: parseRequestServiceError(res) ?? "تعذر إعادة الحجز إلى محجوز.",
    };
  }

  const reserveResult = await reserveHousingUnitsForRequest(requestId);
  if (!reserveResult.ok) {
    return {
      ok: true,
      unitReserveWarning: reserveResult.message,
      unitReplacementWarning: resolvedUnits.replacementSummary,
    };
  }

  return {
    ok: true,
    unitReplacementWarning: resolvedUnits.replacementSummary,
  };
}
