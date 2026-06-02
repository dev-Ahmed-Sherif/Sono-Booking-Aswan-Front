"use server";

import { loadReservationForMutation } from "@/actions/housingReservationMutation";
import { releaseHousingUnitsForRequest } from "@/actions/reserveHousingUnits";
import { updateReservationById } from "@/actions/reservationService";
import {
  isRequestServiceSuccess,
  parseRequestServiceError,
} from "@/lib/housing-request-map";
import {
  RESERVATION_STATUS_CANCELED,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";

export type CancelHousingReservationInput = {
  id: string;
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
};

export type CancelHousingReservationResult =
  | { ok: true; unitReleaseWarning?: string }
  | { ok: false; message: string };

/**
 * `PUT /Reservations/update` with `status: "Canceled"`.
 */
export async function cancelHousingReservation(
  input: CancelHousingReservationInput,
): Promise<CancelHousingReservationResult> {
  const loaded = await loadReservationForMutation(input.id, input);
  if (!loaded.ok) return loaded;

  const { reservation } = loaded;

  const res = await updateReservationById(
    serializeAddReservationDtoForApi({
      id: reservation.id,
      requestId: reservation.requestId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      status: RESERVATION_STATUS_CANCELED,
      totalAmount: reservation.totalAmount,
      checkInDate: reservation.checkInDate,
      actualCheckOutDate: reservation.actualCheckOutDate,
    }),
  );

  if (!isRequestServiceSuccess(res)) {
    return {
      ok: false,
      message: parseRequestServiceError(res) ?? "تعذر إلغاء الحجز.",
    };
  }

  const releaseResult = await releaseHousingUnitsForRequest(
    reservation.requestId,
  );
  if (!releaseResult.ok) {
    return {
      ok: true,
      unitReleaseWarning: releaseResult.message,
    };
  }

  return { ok: true };
}
