"use server";

import { loadReservationForMutation } from "@/actions/housingReservationMutation";
import { updateReservationById } from "@/actions/reservationService";
import {
  isRequestServiceSuccess,
  parseRequestServiceError,
} from "@/lib/housing-request-map";
import {
  RESERVATION_STATUS_RESERVED,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";

export type RestoreHousingReservationInput = {
  id: string;
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
};

export type RestoreHousingReservationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * `PUT /Reservations/update` with `status: "Reserved"`, empty `cancelationReason`,
 * and `actualCheckOutDate` cleared.
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

  return { ok: true };
}
