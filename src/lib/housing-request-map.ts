import type { AvailableUnitType } from "@/actions/availabilityService";
import {
  buildPreservedInquiryFieldsFromUnits,
  mergeAvailabilityGenderFromRows,
  unitSnapshotFromRequestUnitDto,
  type ReservationStoredUnitSnapshot,
} from "@/lib/availability-inquiry";
import type { ReservationRequestFormValues } from "@/schemas";
import {
  enrichUnitsWithApartmentGender,
  resolveGuestsForReservationValidation,
  validateReservationGuestsAgainstUnits,
  type GuestGender,
} from "@/lib/reservation-guest-unit-validation";

/** Mirrors `AddRequestAttachDto` for update `OldImages` collection. */
export type AddRequestOldImagePayload = {
  id: string;
  isPrimary?: boolean;
};

/** Mirrors swagger `RequestCatagory` enum (`AddRequestDto.requestCatagory`). */
export type HousingRequestCatagoryApi = "NewStay" | "Extension";

export const HOUSING_REQUEST_CATAGORY_NEW_STAY: HousingRequestCatagoryApi =
  "NewStay";

export const HOUSING_REQUEST_CATAGORY_EXTENSION: HousingRequestCatagoryApi =
  "Extension";

/** Mirrors `SonoBooking.Common.DTO.Housing.Request.AddRequestDto`. */
export type AddRequestDtoPayload = {
  id?: string;
  requestNumber?: string;
  requestDate?: string;
  startDate: string;
  nights: number;
  requestTypeId: string;
  requestToId: string;
  /** Discount percentage (0–100); set by leader on approval for new stays. */
  percentage: number;
  requestAllocationType: 1 | 2;
  /** Required by API — field name matches backend spelling (`requestCatagory`). */
  requestCatagory: HousingRequestCatagoryApi;
  /** Set for extension requests (`RequestCatagory.Extension`). */
  reservationId?: string;
  /** Original stay request id (`Request.PreviousRequestId`) for extension requests. */
  previousRequestId?: string | null;
  requestUnits: AddRequestUnitDtoPayload[];
  requestCompanions: AddRequestParticipantDtoPayload[];
  /** Kept server attachments on update (`AddRequestDto.OldImages`). */
  oldImages?: AddRequestOldImagePayload[];
  rejectionReason?: string;
  approvedById?: string;
  approvedAt?: string;
};

/**
 * Mirrors `SonoBooking.Common.DTO.Housing.RequestUnit.AddRequestUnitDto`.
 * Request-unit rows do not carry unit status; reserve beds/rooms/apartments separately.
 */
export type AddRequestUnitDtoPayload = {
  id?: string;
  code?: string;
  requestId?: string;
  apartmentId?: string;
  bedId?: string | null;
  roomId?: string | null;
};

/** Keeps only the selected unit id (bed, room, or apartment) — no parent ids in the payload. */
export function toLeafRequestUnitDto(
  unit: AddRequestUnitDtoPayload,
  requestId?: string,
): AddRequestUnitDtoPayload | null {
  const bedId = unit.bedId?.trim();
  const roomId = unit.roomId?.trim();
  const apartmentId = unit.apartmentId?.trim();

  const normalized: AddRequestUnitDtoPayload = {};
  if (bedId) normalized.bedId = bedId;
  else if (roomId) normalized.roomId = roomId;
  else if (apartmentId) normalized.apartmentId = apartmentId;
  else return null;

  const id = unit.id?.trim();
  if (id) normalized.id = id;

  const code = unit.code?.trim();
  if (code) normalized.code = code;

  const unitRequestId = unit.requestId?.trim() || requestId?.trim();
  if (unitRequestId) normalized.requestId = unitRequestId;

  return normalized;
}

/** Normalizes units for `AddRequestDto.requestUnits` / `SyncRequestUnitsAsync`. */
export function normalizeRequestUnitsForAddRequestDto(
  units: AddRequestUnitDtoPayload[],
  requestId?: string,
): AddRequestUnitDtoPayload[] {
  const resolvedRequestId = requestId?.trim();
  return units
    .map((unit) => toLeafRequestUnitDto(unit, resolvedRequestId))
    .filter((u): u is AddRequestUnitDtoPayload => u != null);
}

/**
 * Builds camelCase JSON for `Requests/update` (same shape as `addRequest`).
 * ASP.NET Newtonsoft uses camelCase property names — PascalCase breaks model binding.
 */
export function serializeAddRequestDtoForApi(
  payload: AddRequestDtoPayload & { status?: number | string },
): Record<string, unknown> {
  const requestId = payload.id?.trim();
  const units = normalizeRequestUnitsForAddRequestDto(
    payload.requestUnits ?? [],
    requestId,
  );

  const requestUnits = units.map((u) => {
    const unit: Record<string, unknown> = {};
    if (u.id) unit.id = u.id;
    if (u.code) unit.code = u.code;
    if (u.requestId) unit.requestId = u.requestId;
    if (u.bedId) unit.bedId = u.bedId;
    else if (u.roomId) unit.roomId = u.roomId;
    else if (u.apartmentId) unit.apartmentId = u.apartmentId;
    return unit;
  });

  const requestCompanions = (payload.requestCompanions ?? [])
    .map((c) => {
      const companionId = c.companionId?.trim();
      if (!companionId) return null;
      return {
        ...(c.id ? { id: c.id } : {}),
        ...(c.requestId ? { requestId: c.requestId } : {}),
        companionId,
      };
    })
    .filter(
      (c): c is { companionId: string; requestId?: string; id?: string } =>
        c != null,
    );

  const body: Record<string, unknown> = {
    id: requestId,
    startDate: payload.startDate,
    nights: payload.nights,
    requestTypeId: payload.requestTypeId,
    requestToId: payload.requestToId,
    percentage: payload.percentage,
    requestAllocationType: payload.requestAllocationType,
    requestUnits,
    requestCompanions,
  };

  body.requestCatagory = payload.requestCatagory;
  if (payload.reservationId?.trim()) {
    body.reservationId = payload.reservationId.trim();
  }
  if (payload.previousRequestId?.trim()) {
    body.previousRequestId = payload.previousRequestId.trim();
  }
  if (payload.requestNumber) body.requestNumber = payload.requestNumber;
  if (payload.status != null) {
    body.status =
      typeof payload.status === "string"
        ? payload.status
        : housingRequestStatusToApiName(payload.status);
  }
  if (payload.rejectionReason != null) {
    body.rejectionReason = payload.rejectionReason;
  }
  if (payload.approvedById) body.approvedById = payload.approvedById;
  if (payload.approvedAt) body.approvedAt = payload.approvedAt;

  if (payload.oldImages?.length) {
    body.oldImages = payload.oldImages
      .map((img) => ({
        id: img.id?.trim(),
        isPrimary: Boolean(img.isPrimary),
      }))
      .filter((img) => img.id);
  }

  return body;
}

function appendAddRequestFormScalar(
  formData: FormData,
  key: string,
  value: string | number | undefined | null,
) {
  if (value === undefined || value === null || value === "") return;
  formData.append(key, String(value));
}

/**
 * Multipart body for `RequestsController` add/update (`[FromForm] AddRequestDto`).
 * Uses PascalCase keys and indexed collections for ASP.NET model binding.
 * Extension requests omit units, companions, and file attachments — the backend
 * copies those from `PreviousRequestId`.
 */
export function buildAddRequestFormData(
  payload: AddRequestDtoPayload & { status?: number | string },
  attachmentFiles?: File[],
): FormData {
  const formData = new FormData();
  const isExtension =
    payload.requestCatagory === HOUSING_REQUEST_CATAGORY_EXTENSION;
  const requestId = payload.id?.trim();

  appendAddRequestFormScalar(formData, "Id", requestId);
  appendAddRequestFormScalar(formData, "RequestNumber", payload.requestNumber);
  appendAddRequestFormScalar(formData, "StartDate", payload.startDate);
  appendAddRequestFormScalar(formData, "Nights", payload.nights);
  appendAddRequestFormScalar(formData, "RequestTypeId", payload.requestTypeId);
  appendAddRequestFormScalar(formData, "RequestToId", payload.requestToId);
  appendAddRequestFormScalar(formData, "Percentage", payload.percentage);
  appendAddRequestFormScalar(
    formData,
    "RequestAllocationType",
    payload.requestAllocationType,
  );
  appendAddRequestFormScalar(formData, "RequestCatagory", payload.requestCatagory);
  if (payload.previousRequestId === null) {
    formData.append("PreviousRequestId", "");
  } else {
    appendAddRequestFormScalar(
      formData,
      "PreviousRequestId",
      payload.previousRequestId?.trim(),
    );
  }

  if (payload.status != null) {
    const statusName =
      typeof payload.status === "string"
        ? payload.status
        : housingRequestStatusToApiName(payload.status);
    appendAddRequestFormScalar(formData, "Status", statusName);
  }

  appendAddRequestFormScalar(formData, "RejectionReason", payload.rejectionReason);
  appendAddRequestFormScalar(formData, "ApprovedById", payload.approvedById);
  appendAddRequestFormScalar(formData, "ApprovedAt", payload.approvedAt);

  if (isExtension) {
    return formData;
  }

  const units = normalizeRequestUnitsForAddRequestDto(
    payload.requestUnits ?? [],
    requestId,
  );

  units.forEach((unit, index) => {
    const prefix = `RequestUnits[${index}]`;
    appendAddRequestFormScalar(formData, `${prefix}.Id`, unit.id);
    appendAddRequestFormScalar(formData, `${prefix}.RequestId`, unit.requestId);
    if (unit.bedId) {
      appendAddRequestFormScalar(formData, `${prefix}.BedId`, unit.bedId);
    } else if (unit.roomId) {
      appendAddRequestFormScalar(formData, `${prefix}.RoomId`, unit.roomId);
    } else if (unit.apartmentId) {
      appendAddRequestFormScalar(formData, `${prefix}.ApartmentId`, unit.apartmentId);
    }
  });

  const companions = (payload.requestCompanions ?? [])
    .map((c) => ({
      ...c,
      companionId: c.companionId?.trim() ?? "",
    }))
    .filter((c) => c.companionId.length > 0);

  companions.forEach((companion, index) => {
    const prefix = `RequestCompanions[${index}]`;
    appendAddRequestFormScalar(formData, `${prefix}.Id`, companion.id);
    appendAddRequestFormScalar(formData, `${prefix}.RequestId`, companion.requestId);
    appendAddRequestFormScalar(
      formData,
      `${prefix}.CompanionId`,
      companion.companionId,
    );
  });

  (attachmentFiles ?? []).forEach((file, index) => {
    if (!(file instanceof File) || file.size <= 0) return;
    formData.append(`Images[${index}].Image`, file, file.name);
  });

  if (payload.oldImages !== undefined) {
    const oldImagesToSend =
      payload.oldImages.length > 0
        ? payload.oldImages
        : [{ id: "", isPrimary: false }];

    oldImagesToSend.forEach((img, index) => {
      const prefix = `OldImages[${index}]`;
      appendAddRequestFormScalar(formData, `${prefix}.Id`, img.id?.trim());
      appendAddRequestFormScalar(
        formData,
        `${prefix}.IsPrimary`,
        img.isPrimary ? "true" : "false",
      );
    });
  }

  return formData;
}

/** True when a server-action result is a successful API response (not axios error wrapper). */
export function isRequestServiceSuccess(res: unknown): boolean {
  if (res === null || res === undefined) return false;
  if (typeof res === "string") return res.trim().length > 0;
  if (typeof res !== "object") return false;

  const r = res as Record<string, unknown>;
  if (r.error) return false;

  const succeeded = r.succeeded ?? r.Succeeded ?? r.isSuccess ?? r.IsSuccess;
  if (succeeded === false) return false;

  const statusRaw = r.status ?? r.Status;
  const status =
    typeof statusRaw === "number"
      ? statusRaw
      : typeof statusRaw === "string"
        ? Number(statusRaw)
        : undefined;
  if (status != null && Number.isFinite(status) && status >= 400) {
    return false;
  }

  return true;
}

export function validateLeaderDecisionPayload(
  payload: AddRequestDtoPayload & { status?: number | string },
):
  | { ok: true }
  | { ok: false; message: string } {
  if (!payload.id?.trim()) {
    return { ok: false, message: "معرّف الطلب غير موجود." };
  }
  if (!payload.requestTypeId?.trim()) {
    return {
      ok: false,
      message: "نوع الطلب غير موجود في بيانات الطلب. أعد فتح التفاصيل أو حدّث الصفحة.",
    };
  }
  if (!payload.requestToId?.trim()) {
    return {
      ok: false,
      message: "الجهة الموجّه إليها الطلب غير موجودة في بيانات الطلب.",
    };
  }
  if (!payload.startDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate)) {
    return { ok: false, message: "تاريخ البدء غير صالح في بيانات الطلب." };
  }
  if (!Number.isFinite(payload.nights) || payload.nights <= 0) {
    return { ok: false, message: "عدد الليالي غير صالح في بيانات الطلب." };
  }
  if (!payload.requestUnits?.length) {
    return {
      ok: false,
      message:
        "لا توجد وحدات صالحة مرتبطة بالطلب. لا يمكن حفظ القرار.",
    };
  }
  return { ok: true };
}

export function parseRequestServiceError(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  if ("error" in r && r.error) {
    return String(r.message ?? r.Message ?? r.error ?? "").trim() || null;
  }
  return null;
}

/** Mirrors `AddRequestParticipantDto`. */
export type AddRequestParticipantDtoPayload = {
  id?: string;
  requestId?: string;
  companionId: string;
};

export type ReservationInquiryFormSnapshot = {
  startDateYmd?: string | null;
  startDate?: string | null;
  startDateDisplay?: string | null;
  nights?: string | number | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  allocationType?: string | null;
  allocationTypeLabel?: string | null;
};

export type MapReservationToAddRequestResult =
  | { ok: true; dto: AddRequestDtoPayload }
  | { ok: false; message: string };

const ADD_ERROR_AR =
  "تعذر حفظ الطلب. تحقق من الوحدات المختارة (شقة/غرفة/سرير) وأعد المحاولة.";

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function indexRowsById(rows: unknown[]): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = pickStr(r, "id", "Id");
    if (id) m.set(id.toLowerCase(), r);
  }
  return m;
}

/** EF stores `Status` as enum member name strings (see `Request` entity config). */
export function housingRequestStatusToApiName(
  status: number,
): "Approved" | "NeedCompelete" | "Pending" | "Canceled" {
  switch (status) {
    case 1:
      return "Approved";
    case 2:
      return "NeedCompelete";
    case 4:
      return "Canceled";
    default:
      return "Pending";
  }
}

/** Fills missing `apartmentId` on request-unit rows using beds/rooms lookup tables. */
export function enrichRequestUnitRowsFromHierarchy(
  rows: Record<string, unknown>[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
): Record<string, unknown>[] {
  const bedById = indexRowsById(bedsRaw);
  const roomById = indexRowsById(roomsRaw);

  return rows.map((row) => {
    const next = { ...row };
    let apartmentId = pickStr(next, "apartmentId", "ApartmentId");
    const bedId = pickStr(next, "bedId", "BedId");
    const roomId = pickStr(next, "roomId", "RoomId");

    if (!apartmentId && bedId) {
      const bed = bedById.get(bedId.toLowerCase());
      if (bed) {
        apartmentId = pickStr(bed, "apartmentId", "ApartmentId");
        const roomFromBed = pickStr(bed, "roomId", "RoomId");
        if (!roomId && roomFromBed) {
          next.roomId = roomFromBed;
          next.RoomId = roomFromBed;
        }
      }
    }

    if (!apartmentId && roomId) {
      const room = roomById.get(roomId.toLowerCase());
      if (room) {
        apartmentId = pickStr(room, "apartmentId", "ApartmentId");
      }
    }

    if (apartmentId) {
      next.apartmentId = apartmentId;
      next.ApartmentId = apartmentId;
    }

    return next;
  });
}

/** `AllocationType` enum: Fixed = 1, Flexible = 2. */
export function parseAllocationTypeEnum(
  value: unknown,
): 1 | 2 | undefined {
  if (value === 1 || value === 2) return value;
  if (typeof value === "number" && (value === 1 || value === 2)) {
    return value;
  }
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  if (s === "1" || s === "fixed" || s === "ثابت") return 1;
  if (
    s === "2" ||
    s === "flexible" ||
    s === "مرن" ||
    s === "متحرك" ||
    s === "movable"
  ) {
    return 2;
  }
  const n = Number(s);
  if (n === 1 || n === 2) return n as 1 | 2;
  return undefined;
}

/** Resolves parent ids and gender labels on stored snapshots (not sent on add/update). */
export function enrichStoredUnitsWithHierarchyIds(
  units: ReservationStoredUnitSnapshot[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): ReservationStoredUnitSnapshot[] {
  const roomById = indexRowsById(roomsRaw);
  const bedById = indexRowsById(bedsRaw);
  const aptById = indexRowsById(apartmentsRaw);

  return units.map((unit) => {
    const id = unit.id.trim();
    const idKey = id.toLowerCase();

    if (unit.unitKind === "apartment") {
      const apt = aptById.get(idKey);
      const genderType =
        mergeAvailabilityGenderFromRows(apt) ?? unit.genderType;
      return {
        ...unit,
        apartmentId: unit.apartmentId?.trim() || id,
        roomId: undefined,
        ...(genderType ? { genderType } : {}),
      };
    }

    if (unit.unitKind === "room") {
      const room = roomById.get(idKey);
      const apartmentId =
        unit.apartmentId?.trim() ||
        (room ? pickStr(room, "apartmentId", "ApartmentId") : "");
      const apt = apartmentId
        ? aptById.get(apartmentId.toLowerCase())
        : undefined;
      const genderType =
        mergeAvailabilityGenderFromRows(room, apt) ?? unit.genderType;
      return {
        ...unit,
        apartmentId: apartmentId || unit.apartmentId,
        roomId: unit.roomId?.trim() || id,
        ...(genderType ? { genderType } : {}),
      };
    }

    if (unit.unitKind === "bed") {
      const bed = bedById.get(idKey);
      const roomId =
        unit.roomId?.trim() ||
        (bed ? pickStr(bed, "roomId", "RoomId") : "");
      const room = roomId ? roomById.get(roomId.toLowerCase()) : undefined;
      const apartmentId =
        unit.apartmentId?.trim() ||
        (room ? pickStr(room, "apartmentId", "ApartmentId") : "");
      const apt = apartmentId
        ? aptById.get(apartmentId.toLowerCase())
        : undefined;
      const genderType =
        mergeAvailabilityGenderFromRows(bed, room, apt) ?? unit.genderType;
      return {
        ...unit,
        apartmentId: apartmentId || unit.apartmentId,
        roomId: roomId || unit.roomId,
        ...(genderType ? { genderType } : {}),
      };
    }

    return unit;
  });
}

/** Resolves request-unit rows to enriched snapshots with display titles (not raw ids). */
export function requestUnitDtosToEnrichedSnapshots(
  dtos: AddRequestUnitDtoPayload[],
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  apartmentsRaw: unknown[],
): ReservationStoredUnitSnapshot[] {
  const snapshots = dtos.map((dto) =>
    unitSnapshotFromRequestUnitDto(dto, bedsRaw, roomsRaw, apartmentsRaw),
  );
  return enrichStoredUnitsWithHierarchyIds(
    snapshots,
    bedsRaw,
    roomsRaw,
    apartmentsRaw,
  );
}

export type PrepareHousingRequestSubmitInput = {
  guests: { id: string; name: string; role: "applicant" | "companion" }[];
  getGuestGender: (guestId: string) => GuestGender | undefined;
  inquiryGenders: GuestGender[];
  units: ReservationStoredUnitSnapshot[];
  bedsRaw: unknown[];
  roomsRaw: unknown[];
  apartmentsRaw: unknown[];
};

export type PrepareHousingRequestSubmitResult =
  | { ok: true; requestUnits: AddRequestUnitDtoPayload[] }
  | { ok: false; message: string };

/**
 * Same pre-submit pipeline as new reservation: hierarchy ids, apartment gender, guest/unit checks, DTO mapping.
 */
export function prepareHousingRequestForSubmit(
  input: PrepareHousingRequestSubmitInput,
): PrepareHousingRequestSubmitResult {
  const unitsForSubmit = enrichStoredUnitsWithHierarchyIds(
    input.units,
    input.bedsRaw,
    input.roomsRaw,
    input.apartmentsRaw,
  );
  const unitsWithGender = enrichUnitsWithApartmentGender(
    unitsForSubmit,
    input.bedsRaw,
    input.roomsRaw,
    input.apartmentsRaw,
    input.inquiryGenders,
  );

  const validation = validateReservationGuestsAgainstUnits({
    guests: input.guests,
    inquiryGenders: input.inquiryGenders,
    units: unitsWithGender,
    bedsRaw: input.bedsRaw,
    roomsRaw: input.roomsRaw,
    apartmentsRaw: input.apartmentsRaw,
    getGuestGender: input.getGuestGender,
  });
  if (!validation.ok) return validation;

  const requestUnits: AddRequestUnitDtoPayload[] = [];
  for (const unit of unitsWithGender) {
    if (!unit.id?.trim() || !isValidUnitKind(unit.unitKind)) {
      return { ok: false, message: "بيانات إحدى الوحدات المحفوظة غير صالحة." };
    }
    const mappedUnit = mapStoredUnitToRequestUnitDto(unit);
    if (!mappedUnit.ok) return mappedUnit;
    requestUnits.push(mappedUnit.dto);
  }

  return { ok: true, requestUnits };
}

export function mapStoredUnitToRequestUnitDto(
  unit: ReservationStoredUnitSnapshot,
):
  | { ok: true; dto: AddRequestUnitDtoPayload }
  | { ok: false; message: string } {
  const id = unit.id.trim();
  if (!id) {
    return { ok: false, message: "بيانات إحدى الوحدات المحفوظة غير صالحة." };
  }

  if (unit.unitKind === "apartment") {
    return { ok: true, dto: { apartmentId: id } };
  }
  if (unit.unitKind === "room") {
    return { ok: true, dto: { roomId: id } };
  }
  if (unit.unitKind === "bed") {
    return { ok: true, dto: { bedId: id } };
  }

  return { ok: false, message: "بيانات إحدى الوحدات المحفوظة غير صالحة." };
}

function isValidUnitKind(k: string): k is AvailableUnitType {
  return k === "bed" || k === "room" || k === "apartment";
}

/**
 * Maps reservation form + saved inquiry snapshot to `AddRequestDto` for `Requests/add`.
 */
export function mapReservationToAddRequestDto(input: {
  formValues: ReservationRequestFormValues;
  inquiryForm?: ReservationInquiryFormSnapshot | null;
  units: ReservationStoredUnitSnapshot[];
}): MapReservationToAddRequestResult {
  const { formValues, inquiryForm, units } = input;

  const startDate = formValues.startDate?.trim();
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, message: "تاريخ البدء غير صالح." };
  }

  const nights = formValues.numberOfNights;
  if (!Number.isFinite(nights) || nights < 1) {
    return { ok: false, message: "عدد الليالي غير صالح." };
  }

  const requestTypeId = String(inquiryForm?.requestType ?? "").trim();
  if (!requestTypeId) {
    return {
      ok: false,
      message:
        "نوع الطلب غير محفوظ. أعد استعلام التوفر واحفظ الاختيار من جديد.",
    };
  }

  const requestToId = String(formValues.requestToId ?? "").trim();
  if (!requestToId) {
    return {
      ok: false,
      message: "يرجى اختيار الجهة الموجّه إليها الطلب.",
    };
  }

  const requestAllocationType =
    parseAllocationTypeEnum(
      buildPreservedInquiryFieldsFromUnits(units).allocationType,
    ) ??
    parseAllocationTypeEnum(inquiryForm?.allocationType) ??
    parseAllocationTypeEnum(inquiryForm?.allocationTypeLabel);
  if (!requestAllocationType) {
    return {
      ok: false,
      message:
        "نوع الحجز غير محفوظ. أعد استعلام التوفر واحفظ الاختيار من جديد.",
    };
  }

  if (!units.length) {
    return {
      ok: false,
      message:
        "لا توجد وحدات محفوظة. احفظ الوحدات من استعلام التوفر قبل تقديم الطلب.",
    };
  }

  const requestUnits: AddRequestUnitDtoPayload[] = [];
  for (const unit of units) {
    if (!unit.id?.trim() || !isValidUnitKind(unit.unitKind)) {
      return { ok: false, message: "بيانات إحدى الوحدات المحفوظة غير صالحة." };
    }
    const mappedUnit = mapStoredUnitToRequestUnitDto(unit);
    if (!mappedUnit.ok) return mappedUnit;
    requestUnits.push(mappedUnit.dto);
  }

  const guests = resolveGuestsForReservationValidation(formValues.guests);
  const requestCompanions: AddRequestParticipantDtoPayload[] = guests
    .filter((g) => g.role === "companion")
    .map((g) => ({
      companionId: g.id.trim(),
    }))
    .filter((p) => p.companionId.length > 0);

  const dto: AddRequestDtoPayload = {
    startDate,
    nights: Math.trunc(nights),
    requestTypeId,
    requestToId,
    percentage: 0,
    requestAllocationType,
    requestCatagory: HOUSING_REQUEST_CATAGORY_NEW_STAY,
    requestUnits: normalizeRequestUnitsForAddRequestDto(requestUnits),
    requestCompanions,
  };

  return { ok: true, dto };
}

export function formatAddRequestErrorMessage(message: string): string {
  const m = message.trim();
  if (m === "ADD_ERROR") return ADD_ERROR_AR;
  if (m === "Nights must be greater than zero.")
    return "عدد الليالي يجب أن يكون أكبر من صفر.";
  if (m === "RequestTypeId is required.")
    return "نوع الطلب مطلوب.";
  if (m === "RequestToId is required.")
    return "الجهة الموجّه إليها الطلب مطلوبة.";
  if (m.includes("ApartmentId") || m.includes("BedId") || m.includes("RoomId"))
    return "يجب تحديد وحدة صالحة (شقة أو غرفة أو سرير) لكل صف في الطلب.";
  return m;
}

export function parseAddRequestApiResult(
  res: unknown,
): { ok: true; requestId?: string } | { ok: false; message: string } {
  if (res === null || res === undefined) {
    return { ok: false, message: "استجابة غير متوقعة من الخادم." };
  }
  if (typeof res === "string") {
    const id = res.trim();
    return id
      ? { ok: true, requestId: id }
      : { ok: false, message: "استجابة غير متوقعة من الخادم." };
  }
  if (typeof res !== "object") {
    return { ok: false, message: "استجابة غير متوقعة من الخادم." };
  }
  const r = res as Record<string, unknown>;
  if (r.error) {
    const raw = String(r.message ?? r.error ?? "فشل تقديم الطلب");
    return {
      ok: false,
      message: formatAddRequestErrorMessage(raw),
    };
  }
  const statusRaw = r.status ?? r.Status;
  const status =
    typeof statusRaw === "number"
      ? statusRaw
      : typeof statusRaw === "string"
        ? Number(statusRaw)
        : undefined;
  if (status != null && Number.isFinite(status) && status >= 400) {
    const raw = String(r.message ?? r.Message ?? "فشل تقديم الطلب");
    return {
      ok: false,
      message: formatAddRequestErrorMessage(raw),
    };
  }
  const data = r.data ?? r.Data ?? r.result ?? r.Result;
  const requestId =
    typeof data === "string"
      ? data
      : data && typeof data === "object"
        ? String(
            (data as Record<string, unknown>).id ??
              (data as Record<string, unknown>).Id ??
              "",
          ).trim() || undefined
        : undefined;
  return { ok: true, requestId };
}
