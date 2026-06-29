"use server";

import { loadReservationForMutation } from "@/actions/housingReservationMutation";
import { occupyHousingUnitsForRequest } from "@/actions/reserveHousingUnits";
import { addPayment } from "@/actions/settings/paymentService";
import { updateReservationById } from "@/actions/reservationService";
import {
  isRequestServiceSuccess,
  parseRequestServiceError,
} from "@/lib/housing-request-map";
import {
  PAYMENT_METHOD_CASH,
  PAYMENT_STATUS_PAID,
  parsePaymentMethodInput,
  serializeAddPaymentDtoForApi,
  type PaymentMethod,
} from "@/lib/payment-map";
import { computeFinalAmountAfterDiscount } from "@/lib/reservation-discount";
import {
  RESERVATION_STATUS_COMPLETED,
  reservationEndDateAtNoonIso,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";

export type CheckInHousingReservationInput = {
  id: string;
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
  /** 0–100 */
  discountPercent: number;
  /** Base amount before discount (from reservation row). */
  baseTotalAmount: number;
  paymentMethod?: PaymentMethod;
};

export type CheckInHousingReservationResult =
  | { ok: true; paymentWarning?: string; unitOccupancyWarning?: string }
  | { ok: false; message: string };

function isDuplicatePaymentError(res: unknown): boolean {
  const err = res as {
    error?: string;
    message?: string;
    status?: number;
  };
  const msg = String(err.message ?? "").toLowerCase();
  return (
    err.status === 409 ||
    msg.includes("409") ||
    msg.includes("duplicate") ||
    msg.includes("already exists") ||
    msg.includes("موجود") ||
    msg.includes("مسجل")
  );
}

/**
 * `PUT /Reservations/update` with `status: "Completed"`, `checkInDate` set to now,
 * `actualCheckOutDate` set to endDate at 12:00:00, then `POST /Payments/add`, then mark units Occupied.
 */
export async function checkInHousingReservation(
  input: CheckInHousingReservationInput,
): Promise<CheckInHousingReservationResult> {
  const discountPercent = Number(input.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return { ok: false, message: "نسبة الخصم يجب أن تكون بين 0 و 100." };
  }

  const paymentMethod =
    parsePaymentMethodInput(input.paymentMethod) ?? PAYMENT_METHOD_CASH;

  const loaded = await loadReservationForMutation(input.id, input);
  if (!loaded.ok) return loaded;

  const { reservation } = loaded;
  const reservationId = (reservation.id ?? input.id).trim();
  const requestId =
    reservation.requestId?.trim() || input.requestId?.trim();
  if (!requestId) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }

  const nowIso = new Date().toISOString();
  const endDateYmd =
    reservation.endDate?.trim().slice(0, 10) ||
    input.endDateYmd?.trim().slice(0, 10) ||
    "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateYmd)) {
    return { ok: false, message: "تاريخ نهاية الحجز غير صالح." };
  }
  const plannedCheckOutIso = reservationEndDateAtNoonIso(endDateYmd);
  const totalAmount = computeFinalAmountAfterDiscount(
    input.baseTotalAmount,
    discountPercent,
  );

  const res = await updateReservationById(
    serializeAddReservationDtoForApi({
      id: reservationId,
      requestId,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      status: RESERVATION_STATUS_COMPLETED,
      totalAmount,
      checkInDate: nowIso,
      actualCheckOutDate: plannedCheckOutIso,
      cancelationReason: "",
    }),
  );

  if (!isRequestServiceSuccess(res)) {
    return {
      ok: false,
      message: parseRequestServiceError(res) ?? "تعذر تأكيد وصول الحجز.",
    };
  }

  const paymentRes = await addPayment(
    serializeAddPaymentDtoForApi({
      amount: totalAmount,
      paymentMethod,
      paymentStatus: PAYMENT_STATUS_PAID,
      paymentDate: nowIso,
      transactionReference: `CHK-${reservationId.slice(0, 8)}-${Date.now()}`,
      reservationId,
    }),
  );

  const paymentOk =
    isRequestServiceSuccess(paymentRes) || isDuplicatePaymentError(paymentRes);

  if (!paymentOk) {
    const paymentMessage =
      parseRequestServiceError(paymentRes) ??
      (paymentRes as { message?: string })?.message ??
      "تعذر تسجيل الدفع.";

    return {
      ok: true,
      paymentWarning: paymentMessage,
    };
  }

  const occupyResult = await occupyHousingUnitsForRequest(requestId);
  if (!occupyResult.ok) {
    return {
      ok: true,
      unitOccupancyWarning: occupyResult.message,
    };
  }

  return { ok: true };
}
