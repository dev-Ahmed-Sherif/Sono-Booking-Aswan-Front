"use server";

import {
  getRequestById,
  getRequestParticipantsAll,
  getRequestUnitsAll,
  updateRequestById,
} from "@/actions/requestService";
import { getLookupArray } from "@/lib/availability-inquiry";
import {
  buildCancelRequestPayload,
  extractApiEntity,
  extractCompanionIdsFromParticipantRows,
  filterRowsByRequestId,
  parseRequestDetail,
  parseRequestUnitFromApi,
  resolveParticipantRowsForRequest,
} from "@/lib/housing-request-detail";
import {
  formatAddRequestErrorMessage,
  isRequestServiceSuccess,
  parseRequestServiceError,
  serializeAddRequestDtoForApi,
} from "@/lib/housing-request-map";

export type CancelHousingRequestResult =
  | { ok: true }
  | { ok: false; message: string };

export async function cancelHousingRequest(
  requestId: string,
  options?: { ownerUserId?: string; statusLabel?: string },
): Promise<CancelHousingRequestResult> {
  const id = requestId.trim();
  if (!id) {
    return { ok: false, message: "معرّف الطلب غير متوفر." };
  }

  const reqRes = await getRequestById(id);
  const raw = extractApiEntity(reqRes);
  if (!raw) {
    return {
      ok: false,
      message: parseRequestServiceError(reqRes) ?? "لم يتم العثور على بيانات الطلب.",
    };
  }

  const ownerUserId = options?.ownerUserId?.trim();
  const [unitsRes, partsRes] = await Promise.all([
    getRequestUnitsAll(),
    ownerUserId
      ? getRequestParticipantsAll(ownerUserId)
      : getRequestParticipantsAll(),
  ]);

  const unitsLoadError = parseRequestServiceError(unitsRes);
  if (unitsLoadError) {
    return { ok: false, message: unitsLoadError };
  }

  const detail = parseRequestDetail(
    raw,
    options?.statusLabel?.trim() || "قيد المراجعة",
  );
  if (!detail) {
    return { ok: false, message: "بيانات الطلب غير صالحة." };
  }

  const requestUnits = filterRowsByRequestId(getLookupArray(unitsRes), id)
    .map((row) => parseRequestUnitFromApi(row))
    .filter((u): u is NonNullable<ReturnType<typeof parseRequestUnitFromApi>> =>
      u != null,
    );

  const participantRows = resolveParticipantRowsForRequest(
    raw,
    partsRes,
    id,
    reqRes,
  );
  const companionIds = extractCompanionIdsFromParticipantRows(participantRows);

  const payload = buildCancelRequestPayload(detail, requestUnits, companionIds);
  const res = await updateRequestById(serializeAddRequestDtoForApi(payload));

  if (!isRequestServiceSuccess(res)) {
    const message =
      parseRequestServiceError(res) ??
      formatAddRequestErrorMessage("فشل إلغاء الطلب");
    return { ok: false, message };
  }

  return { ok: true };
}
