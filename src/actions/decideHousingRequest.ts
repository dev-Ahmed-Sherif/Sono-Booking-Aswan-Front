"use server";

import { getBeds } from "@/actions/settings/bedService";
import { getRooms } from "@/actions/settings/roomService";
import {
  getAllRequests,
  getRequestById,
  getRequestParticipantsAll,
  getRequestUnitsAll,
  updateRequestById,
} from "@/actions/requestService";
import {
  buildLeaderRequestDecisionPayload,
  extractApiEntity,
  extractCompanionIdsFromParticipantRows,
  filterRowsByRequestId,
  parseRequestUnitFromApi,
  resolveParticipantRowsForRequest,
  resolveRequestLinkedContentRequestId,
  type LeaderRequestDecision,
} from "@/lib/housing-request-detail";
import { getLookupArray } from "@/lib/availability-inquiry";
import {
  enrichRequestUnitRowsFromHierarchy,
  formatAddRequestErrorMessage,
  isRequestServiceSuccess,
  parseRequestServiceError,
  validateLeaderDecisionPayload,
} from "@/lib/housing-request-map";
import {
  buildApprovedStayWindowsForOverlap,
  buildOverlapUnitsByRequestId,
  buildUnitHierarchyMaps,
  extractRequestStayWindow,
  findPendingUnitOverlaps,
  HOUSING_REQUEST_OVERLAP_APPROVE_MESSAGE,
} from "@/lib/housing-request-overlap";
import { getAllExtensions } from "@/actions/settings/extensionService";
import { addReservation, getAllReservations } from "@/actions/reservationService";
import { reserveHousingUnitsForApproval } from "@/actions/reserveHousingUnits";
import {
  buildAddReservationDtoFromRequest,
  serializeAddReservationDtoForApi,
} from "@/lib/reservation-map";

export type DecideHousingRequestInput = {
  requestId: string;
  decision: LeaderRequestDecision;
  leaderUserId: string;
  ownerUserId?: string;
  rejectionReason?: string;
};

export type DecideHousingRequestResult =
  | { ok: true; unitReserveWarning?: string; reservationWarning?: string }
  | { ok: false; message: string };

async function createReservationForApprovedRequest(
  raw: Record<string, unknown>,
  requestId: string,
): Promise<string | null> {
  const dto = buildAddReservationDtoFromRequest(raw, requestId);
  if (!dto) {
    return "تعذر تجهيز بيانات الحجز (تحقق من تواريخ الطلب).";
  }

  const res = await addReservation(serializeAddReservationDtoForApi(dto));
  if (isRequestServiceSuccess(res)) return null;

  const apiError =
    parseRequestServiceError(res) ?? "تعذر إنشاء سجل الحجز.";
  if (/duplicate|already exists|unique|FK_Reservations_Request/i.test(apiError)) {
    return null;
  }
  return apiError;
}

export async function decideHousingRequest(
  input: DecideHousingRequestInput,
): Promise<DecideHousingRequestResult> {
  const requestId = input.requestId?.trim();
  const leaderUserId = input.leaderUserId?.trim();
  if (!requestId || !leaderUserId) {
    return { ok: false, message: "بيانات الطلب أو المستخدم غير مكتملة." };
  }

  const reqRes = await getRequestById(requestId);
  const raw = extractApiEntity(reqRes);
  if (!raw) {
    const loadErr = parseRequestServiceError(reqRes);
    return {
      ok: false,
      message: loadErr ?? "لم يتم العثور على بيانات الطلب.",
    };
  }

  const ownerUserId = input.ownerUserId?.trim();

  const contentRequestId = resolveRequestLinkedContentRequestId(raw, requestId);

  const [unitsRes, partsRes, bedsRes, roomsRes] = await Promise.all([
    getRequestUnitsAll(),
    ownerUserId
      ? getRequestParticipantsAll(ownerUserId)
      : getRequestParticipantsAll(),
    getBeds(undefined, { allStatuses: true }),
    getRooms(undefined, { allStatuses: true }),
  ]);

  const unitsLoadError = parseRequestServiceError(unitsRes);
  if (unitsLoadError) {
    return { ok: false, message: unitsLoadError };
  }

  let contentRequestRaw = raw;
  if (contentRequestId !== requestId) {
    const previousReqRes = await getRequestById(contentRequestId);
    const previousRaw = extractApiEntity(previousReqRes);
    if (previousRaw) {
      contentRequestRaw = previousRaw;
    }
  }

  const unitRows = enrichRequestUnitRowsFromHierarchy(
    filterRowsByRequestId(getLookupArray(unitsRes), contentRequestId),
    getLookupArray(bedsRes),
    getLookupArray(roomsRes),
  );

  const requestUnits = unitRows
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is NonNullable<ReturnType<typeof parseRequestUnitFromApi>> =>
      u != null,
    );

  const participantRows = resolveParticipantRowsForRequest(
    contentRequestRaw,
    partsRes,
    contentRequestId,
    reqRes,
  );
  const companionIds =
    extractCompanionIdsFromParticipantRows(participantRows);

  const payload = buildLeaderRequestDecisionPayload(
    raw,
    requestUnits,
    companionIds,
    input.decision,
    {
      leaderUserId,
      rejectionReason: input.rejectionReason,
    },
  );

  const validation = validateLeaderDecisionPayload(payload);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (input.decision === "approve") {
    const pendingStay = extractRequestStayWindow(raw);
    if (pendingStay) {
      const bedsRaw = getLookupArray(bedsRes);
      const roomsRaw = getLookupArray(roomsRes);
      const maps = buildUnitHierarchyMaps(bedsRaw, roomsRaw);
      const [allRequestsRes, extensionsRes, reservationsRes] = await Promise.all([
        getAllRequests(),
        getAllExtensions(),
        getAllReservations(),
      ]);
      const allRequests = getLookupArray(allRequestsRes);
      const unitsByRequestId = buildOverlapUnitsByRequestId(
        allRequests,
        getLookupArray(unitsRes),
        bedsRaw,
        roomsRaw,
        parseRequestUnitFromApi,
      );

      const approvedStays = buildApprovedStayWindowsForOverlap(allRequests, {
        extensionsRaw: getLookupArray(extensionsRes),
        reservationsRaw: getLookupArray(reservationsRes),
      });

      const overlaps = findPendingUnitOverlaps({
        pending: [pendingStay],
        approved: approvedStays,
        unitsByRequestId,
        maps,
        requestItems: allRequests,
      });

      if (overlaps.has(pendingStay.requestId.toLowerCase())) {
        return { ok: false, message: HOUSING_REQUEST_OVERLAP_APPROVE_MESSAGE };
      }
    }
  }

  let res = await updateRequestById(payload);

  const finishApproval = async (): Promise<DecideHousingRequestResult> => {
    if (input.decision !== "approve") {
      return { ok: true };
    }

    const reserveResult = await reserveHousingUnitsForApproval(requestUnits);
    const unitReserveWarning = !reserveResult.ok
      ? reserveResult.message
      : undefined;

    const reservationWarning =
      (await createReservationForApprovedRequest(raw, requestId)) ?? undefined;

    return {
      ok: true,
      ...(unitReserveWarning ? { unitReserveWarning } : {}),
      ...(reservationWarning ? { reservationWarning } : {}),
    };
  };

  if (!isRequestServiceSuccess(res)) {
    let apiError =
      parseRequestServiceError(res) ?? "تعذر حفظ قرار الموافقة أو الرفض.";

    const fkApproved =
      payload.approvedById &&
      /approved|approv|FK_|foreign key|REFERENCE/i.test(apiError);

    if (fkApproved) {
      const retryPayload = { ...payload };
      delete retryPayload.approvedById;
      delete retryPayload.approvedAt;
      res = await updateRequestById(retryPayload);
      if (isRequestServiceSuccess(res)) {
        return finishApproval();
      }
      apiError =
        parseRequestServiceError(res) ??
        "تعذر حفظ قرار الموافقة أو الرفض.";
    }

    console.error("[decideHousingRequest] update failed", {
      requestId,
      apiError,
      payload,
      res,
    });
    return { ok: false, message: formatAddRequestErrorMessage(apiError) };
  }

  return finishApproval();
}
