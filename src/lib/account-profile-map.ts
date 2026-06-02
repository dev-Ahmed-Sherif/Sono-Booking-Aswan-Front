import type { DocumentType } from "@/schemas";
import {
  documentTypeFromApiValue,
  parseBirthDateValue,
} from "@/lib/companion-registration";

export function genderFormValueFromApi(gender: unknown): "male" | "female" {
  if (gender === 2 || gender === "2" || gender === "female") return "female";
  if (gender === 1 || gender === "1" || gender === "male") return "male";
  return "male";
}

/** User DTO from `getUserById` — supports `{ data }` wrapper or flat body. */
export function unwrapAccountUserDto(
  result: unknown,
): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (r.error) return null;

  const nested = r.data ?? r.Data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  if (
    r.userName != null ||
    r.UserName != null ||
    r.id != null ||
    r.Id != null ||
    r.email != null ||
    r.Email != null
  ) {
    return r;
  }

  return null;
}

export function mapAccountApiToFormValues(
  data: Record<string, unknown>,
): {
  id?: string;
  userName: string;
  email: string;
  documentNumber: string;
  documentType: DocumentType;
  gender: "male" | "female";
  birthDate: Date | undefined;
  phone: string;
  documentImageUrl?: string;
} {
  const birthDate = parseBirthDateValue(
    data.birthDate ?? data.BirthDate,
  );

  const idRaw = data.id ?? data.Id;
  const id =
    idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== ""
      ? String(idRaw).trim()
      : undefined;

  return {
    id,
    userName: String(data.userName ?? data.UserName ?? "").trim(),
    email: String(data.email ?? data.Email ?? "").trim(),
    documentNumber: String(
      data.documentNumber ??
        data.DocumentNumber ??
        data.nationalId ??
        data.NationalId ??
        "",
    ).trim(),
    documentType: documentTypeFromApiValue(
      data.documentType ?? data.DocumentType,
    ),
    gender: genderFormValueFromApi(data.gender ?? data.Gender),
    birthDate,
    phone: String(
      data.phone ?? data.Phone ?? data.mobile ?? data.Mobile ?? "",
    ).trim(),
    documentImageUrl:
      String(
        data.documentImageUrl ??
          data.DocumentImageUrl ??
          data.imageUrl ??
          data.ImageUrl ??
          "",
      ).trim() || undefined,
  };
}

export const toDateOnlyString = (
  input: Date | string | undefined | null,
): string => {
  if (input == null) {
    return "";
  }
  if (typeof input === "string") {
    const match = input.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : input;
  }
  if (!(input instanceof Date) || Number.isNaN(input.getTime())) {
    return "";
  }
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
