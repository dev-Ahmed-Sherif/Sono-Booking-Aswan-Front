import type { z } from "zod";

import { floatingUnitStaffSchema } from "@/schemas";

/** Inferred from `floatingUnitStaffSchema` (matches `AddFloatingUnitStaffDto`). */
export type FloatingUnitStaffFormValues = z.infer<typeof floatingUnitStaffSchema>;

function appendScalar(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  formData.append(key, String(value));
}

/**
 * Multipart body for `[FromForm] AddFloatingUnitStaffDto` (PascalCase keys).
 * Call after validating with `floatingUnitStaffSchema.parse(...)`.
 */
export function buildFloatingUnitStaffFormData(
  data: FloatingUnitStaffFormValues,
): FormData {
  const formData = new FormData();
  appendScalar(formData, "Id", data.id);
  formData.append("Name", data.name);
  formData.append("Job", data.job);
  formData.append("Mobile", data.mobile);
  formData.append("Email", data.email);
  formData.append("Gender", String(data.gender));
  formData.append("IDType", String(data.idType));
  formData.append("Identity", data.identity);
  formData.append("NationalityId", data.nationalityId);
  formData.append("FloatingUnitId", data.floatingUnitId);
  formData.append("IsDelegate", data.isDelegate === true ? "true" : "false");
  if (data.delegateAttachment instanceof File) {
    formData.append("DelegateAttachment", data.delegateAttachment);
  }
  return formData;
}
