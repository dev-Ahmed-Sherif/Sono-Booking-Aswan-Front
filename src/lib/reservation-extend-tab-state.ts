import {
  findLatestExtensionRequest,
  findLatestExtensionRequestForReservation,
  isHousingRequestApproved,
  type HousingRequestTableRow,
  type MapRequestsToTableRowsOptions,
} from "@/lib/housing-request-list";
import {
  findReservationById,
  pickLastCompletedReservation,
  type ReservationDtoPayload,
} from "@/lib/reservation-map";

export type ExtendTabState = {
  reservation: ReservationDtoPayload | null;
  extensionRequest: HousingRequestTableRow | null;
};

/** Resolves extend-tab reservation + latest linked extension request. */
export function resolveExtendTabState(
  reservationsRaw: unknown[],
  requestsRaw: unknown[],
  options?: MapRequestsToTableRowsOptions,
): ExtendTabState {
  let reservation = pickLastCompletedReservation(reservationsRaw);
  let extensionRequest: HousingRequestTableRow | null = null;

  const latestExtension = findLatestExtensionRequest(requestsRaw, options);

  if (latestExtension) {
    extensionRequest = latestExtension.row;
    if (latestExtension.reservationId) {
      const linked = findReservationById(
        reservationsRaw,
        latestExtension.reservationId,
      );
      if (linked) {
        if (isHousingRequestApproved(latestExtension.row.status)) {
          reservation = linked;
        } else if (!reservation) {
          reservation = linked;
        }
      }
    }
  }

  if (!extensionRequest && reservation?.id) {
    extensionRequest = findLatestExtensionRequestForReservation(
      requestsRaw,
      reservation.id,
      options,
    );
  }

  return { reservation, extensionRequest };
}
