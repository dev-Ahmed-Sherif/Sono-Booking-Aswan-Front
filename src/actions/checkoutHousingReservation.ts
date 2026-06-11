"use server";

import { loadReservationForMutation } from "@/actions/housingReservationMutation";
import { releaseHousingUnitsForRequest } from "@/actions/reserveHousingUnits";
import { updateReservationById } from "@/actions/reservationService";
import {
  isRequestServiceSuccess,
  parseRequestServiceError,
} from "@/lib/housing-request-map";
import {
  RESERVATION_STATUS_CHECKOUT,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";

export type CheckoutHousingReservationInput = {
  id: string;
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
};

export type CheckoutHousingReservationResult =
  | { ok: true; unitReleaseWarning?: string }
  | { ok: false; message: string };

/**
 * `PUT /Reservations/update` with `status: "Checkout"` and `actualCheckOutDate` set to now.
 */
export async function checkoutHousingReservation(
  input: CheckoutHousingReservationInput,
): Promise<CheckoutHousingReservationResult> {
  const loaded = await loadReservationForMutation(input.id, input);
  if (!loaded.ok) return loaded;

  const { reservation } = loaded;
  const requestId =
    reservation.requestId?.trim() || input.requestId?.trim();
  if (!requestId) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }

  const nowIso = new Date().toISOString();

  const res = await updateReservationById(
    serializeAddReservationDtoForApi({
      id: reservation.id,
      requestId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      status: RESERVATION_STATUS_CHECKOUT,
      totalAmount: reservation.totalAmount,
      checkInDate: reservation.checkInDate ?? nowIso,
      actualCheckOutDate: nowIso,
    }),
  );

  if (!isRequestServiceSuccess(res)) {
    return {
      ok: false,
      message: parseRequestServiceError(res) ?? "تعذر تسجيل مغادرة الحجز.",
    };
  }

  const releaseResult = await releaseHousingUnitsForRequest(requestId);
  if (!releaseResult.ok) {
    return {
      ok: true,
      unitReleaseWarning: releaseResult.message,
    };
  }

  return { ok: true };
}
