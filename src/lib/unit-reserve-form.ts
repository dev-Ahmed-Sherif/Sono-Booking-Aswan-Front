import { extractApartmentImagesFromApi } from "@/lib/apartment-form-map";
import { extractBedImagesFromApi } from "@/lib/bed-form-map";
import { extractRoomImagesFromApi } from "@/lib/room-form-map";

/** `UnitStatus.Available` — matches bed/room forms (`String(values.status)`). */
export const UNIT_STATUS_AVAILABLE = "1";

/** `UnitStatus.Reserved` — matches bed/room forms (`String(values.status)`). */
export const UNIT_STATUS_RESERVED = "2";

/** `UnitStatus.Occupied` — matches bed/room forms (`String(values.status)`). */
export const UNIT_STATUS_OCCUPIED = "3";

function pickStr(record: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
}

function pickNumStr(record: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "";
}

function appendOldImages(
  form: FormData,
  images: { id: string; attachmentId: string; isPrimary: boolean }[],
): void {
  images.forEach((img, index) => {
    const oldId = (img.id || img.attachmentId).trim();
    form.append(`OldImages[${index}].Id`, oldId);
    form.append(
      `OldImages[${index}].IsPrimary`,
      img.isPrimary ? "true" : "false",
    );
  });
}

export function buildBedReserveFormData(api: Record<string, unknown>): FormData {
  return buildBedUnitStatusFormData(api, UNIT_STATUS_RESERVED);
}

export function buildBedOccupiedFormData(api: Record<string, unknown>): FormData {
  return buildBedUnitStatusFormData(api, UNIT_STATUS_OCCUPIED);
}

export function buildBedAvailableFormData(api: Record<string, unknown>): FormData {
  return buildBedUnitStatusFormData(api, UNIT_STATUS_AVAILABLE);
}

function buildBedUnitStatusFormData(
  api: Record<string, unknown>,
  status: string,
): FormData {
  const form = new FormData();
  const id = pickStr(api, ["id", "Id"]);
  if (id) form.append("id", id);

  const bedNumber = pickStr(api, ["bedNumber", "BedNumber"]);
  if (bedNumber) form.append("bedNumber", bedNumber);

  form.append("description", pickStr(api, ["description", "Description"]));
  form.append("dimensions", pickStr(api, ["dimensions", "Dimensions"]));
  form.append("price", pickNumStr(api, ["price", "Price"]));
  form.append("status", status);
  form.append("roomId", pickStr(api, ["roomId", "RoomId", "room", "Room"]));

  appendOldImages(form, extractBedImagesFromApi(api));
  return form;
}

export function buildRoomReserveFormData(api: Record<string, unknown>): FormData {
  return buildRoomUnitStatusFormData(api, UNIT_STATUS_RESERVED);
}

export function buildRoomOccupiedFormData(api: Record<string, unknown>): FormData {
  return buildRoomUnitStatusFormData(api, UNIT_STATUS_OCCUPIED);
}

export function buildRoomAvailableFormData(api: Record<string, unknown>): FormData {
  return buildRoomUnitStatusFormData(api, UNIT_STATUS_AVAILABLE);
}

function buildRoomUnitStatusFormData(
  api: Record<string, unknown>,
  status: string,
): FormData {
  const form = new FormData();
  const id = pickStr(api, ["id", "Id"]);
  if (id) form.append("id", id);

  const roomNumber = pickStr(api, ["roomNumber", "RoomNumber"]);
  if (roomNumber) form.append("roomNumber", roomNumber);

  form.append("description", pickStr(api, ["description", "Description"]));
  form.append("price", pickNumStr(api, ["price", "Price"]));
  form.append("status", status);
  form.append(
    "apartmentId",
    pickStr(api, ["apartmentId", "ApartmentId", "apartment", "Apartment"]),
  );
  form.append(
    "roomTypeId",
    pickStr(api, ["roomTypeId", "RoomTypeId", "roomType", "RoomType"]),
  );

  appendOldImages(form, extractRoomImagesFromApi(api));
  return form;
}

export function buildApartmentReserveFormData(
  api: Record<string, unknown>,
): FormData {
  return buildApartmentUnitStatusFormData(api, UNIT_STATUS_RESERVED);
}

export function buildApartmentOccupiedFormData(
  api: Record<string, unknown>,
): FormData {
  return buildApartmentUnitStatusFormData(api, UNIT_STATUS_OCCUPIED);
}

export function buildApartmentAvailableFormData(
  api: Record<string, unknown>,
): FormData {
  return buildApartmentUnitStatusFormData(api, UNIT_STATUS_AVAILABLE);
}

function buildApartmentUnitStatusFormData(
  api: Record<string, unknown>,
  status: string,
): FormData {
  const form = new FormData();
  const id = pickStr(api, ["id", "Id"]);
  if (id) form.append("id", id);

  const apartmentNumber = pickStr(api, ["apartmentNumber", "ApartmentNumber"]);
  if (apartmentNumber) form.append("apartmentNumber", apartmentNumber);

  form.append("description", pickStr(api, ["description", "Description"]));
  form.append("price", pickNumStr(api, ["price", "Price"]));
  form.append("status", status);
  form.append("gender", pickNumStr(api, ["gender", "Gender"]));
  form.append(
    "allocationType",
    pickNumStr(api, ["allocationType", "AllocationType"]),
  );
  form.append("street", pickStr(api, ["street", "Street"]));
  form.append("buildingNumber", pickStr(api, ["buildingNumber", "BuildingNumber"]));
  form.append("floor", pickStr(api, ["floor", "Floor"]));
  form.append(
    "detailedAddress",
    pickStr(api, ["detailedAddress", "DetailedAddress"]),
  );
  form.append(
    "apartmentTypeId",
    pickStr(api, [
      "apartmentTypeId",
      "ApartmentTypeId",
      "apartmentType",
      "ApartmentType",
    ]),
  );
  form.append(
    "governorateId",
    pickStr(api, ["governorateId", "GovernorateId", "governorate", "Governorate"]),
  );
  form.append("cityId", pickStr(api, ["cityId", "CityId", "city", "City"]));

  appendOldImages(form, extractApartmentImagesFromApi(api));
  return form;
}

export function unwrapUnitApiEntity(
  response: unknown,
): Record<string, unknown> | null {
  if (!response || typeof response !== "object") return null;
  if ("error" in response && (response as { error?: string }).error) {
    return null;
  }
  const r = response as Record<string, unknown>;
  const data = r.data ?? r.Data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (pickStr(r, ["id", "Id"])) return r;
  return null;
}
