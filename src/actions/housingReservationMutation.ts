"use server";

import { getReservationById } from "@/actions/reservationService";
import { extractApiEntity } from "@/lib/housing-request-detail";
import { parseRequestServiceError } from "@/lib/housing-request-map";
import {
  parseReservationFromApi,
  type ReservationDtoPayload,
} from "@/lib/reservation-map";

export type ReservationMutationFallback = {
  requestId?: string;
  startDateYmd?: string;
  endDateYmd?: string;
};

export async function loadReservationForMutation(
  id: string,
  fallback?: ReservationMutationFallback,
): Promise<
  | { ok: true; reservation: ReservationDtoPayload }
  | { ok: false; message: string }
> {
  const trimmedId = id.trim();
  if (!trimmedId) {
    return { ok: false, message: "معرّف الحجز غير موجود." };
  }

  const loaded = await getReservationById(trimmedId);
  const raw = extractApiEntity(loaded);
  const existing = raw ? parseReservationFromApi(raw) : null;

  if (existing) {
    return { ok: true, reservation: existing };
  }

  const requestId = fallback?.requestId?.trim() ?? "";
  const startDate = fallback?.startDateYmd?.trim() ?? "";
  const endDate = fallback?.endDateYmd?.trim() ?? "";

  if (!requestId || !startDate || !endDate) {
    const loadErr = parseRequestServiceError(loaded);
    return {
      ok: false,
      message: loadErr ?? "تعذر تحميل بيانات الحجز.",
    };
  }

  return {
    ok: true,
    reservation: {
      id: trimmedId,
      requestId,
      startDate,
      endDate,
      status: 1,
      totalAmount: 0,
    },
  };
}
