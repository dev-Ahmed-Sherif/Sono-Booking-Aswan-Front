import type { z } from "zod";

import { floatingUnitSchema } from "@/schemas";

export type FloatingUnitFormValues = z.infer<typeof floatingUnitSchema>;

function appendFormScalar(
  formData: FormData,
  key: string,
  value: string | number | undefined | null,
) {
  if (value === undefined || value === null || value === "") return;
  formData.append(key, String(value));
}

/** Local calendar date as dd/MM/yyyy (backend validator expects this format). */
function optionalDateToFormValue(
  date: Date | null | undefined,
): string | undefined {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return undefined;
  }
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Convert YYYY to DateOnly-compatible value for backend binder. */
function manufactureYearToFormValue(year: string): string {
  const y = year.trim();
  if (/^\d{4}$/.test(y)) return `${y}-01-01`;
  return y;
}

/** Build multipart body for `AddFloatingUnitDto` / `[FromForm]` binding (PascalCase keys). */
export function buildFloatingUnitFormData(
  data: FloatingUnitFormValues,
): FormData {
  const formData = new FormData();
  appendFormScalar(formData, "Id", data.id);
  formData.append("Code", String(data.code).trim());
  formData.append("NameAr", data.nameAr);
  if (data.nameEn !== undefined && data.nameEn !== null && data.nameEn !== "") {
    formData.append("NameEn", data.nameEn);
  }
  formData.append("LicenseNumber", data.licenseNumber);
  formData.append("Length", String(data.length));
  formData.append("Width", String(data.width));
  formData.append("PassengerNumber", String(data.passengerNumber));
  formData.append("RoomNumber", String(data.roomNumber));
  formData.append("ManufactureYear", manufactureYearToFormValue(data.manufactureYear));
  const last = optionalDateToFormValue(data.lastMaintenanceDate ?? undefined);
  if (last) formData.append("LastMaintenanceDate", last);
  const next = optionalDateToFormValue(data.nextMaintenanceDate ?? undefined);
  if (next) formData.append("NextMaintenanceDate", next);
  formData.append("UnitTypeId", data.unitTypeId);
  formData.append(
    "IsAccepted",
    data.isAccepted === true ? "true" : "false",
  );
  if (data.imageUrl instanceof File) {
    formData.append("ImageUrl", data.imageUrl);
  }
  return formData;
}
