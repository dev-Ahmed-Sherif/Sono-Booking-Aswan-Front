import type { DocumentType } from "@/schemas";

export type RelationshipOption = { value: string; label: string };

export function documentTypeToApiNumber(documentType: DocumentType): 1 | 2 | 3 {
  if (documentType === "Passport") return 2;
  if (documentType === "ResidencePermit") return 3;
  return 1;
}

export function documentTypeFromApiValue(value: unknown): DocumentType {
  const numeric = Number(value);
  if (numeric === 2) return "Passport";
  if (numeric === 3) return "ResidencePermit";
  const text = String(value ?? "").trim();
  if (text === "Passport" || text === "2") return "Passport";
  if (text === "ResidencePermit" || text === "3") return "ResidencePermit";
  return "IDCard";
}

/** Shown when أب / أم / زوج is selected but already assigned to another companion. */
export const FATHER_MOTHER_DUPLICATE_MESSAGE =
  "لايمكن اضافة اب او ام او زوج اكثر من مرة واحدة";

/** أب / أم / زوج: one companion each; other relationships may repeat. */
export function normalizeRelationshipLabelForMatch(label: string): string {
  return label.trim().replace(/^ال/, "").replace(/\s+/g, "");
}

export function isFatherMotherRelationship(label: string): boolean {
  const normalized = normalizeRelationshipLabelForMatch(label);
  if (
    normalized === "أب" ||
    normalized === "اب" ||
    normalized === "أم" ||
    normalized === "ام" ||
    normalized === "زوج" ||
    normalized === "زوجة"
  ) {
    return true;
  }
  const en = label.trim().toLowerCase();
  return (
    en === "father" ||
    en === "mother" ||
    en === "husband" ||
    en === "wife" ||
    en === "spouse"
  );
}

export function filterRelationshipOptionsForNewCompanion(
  options: RelationshipOption[],
  savedCompanions: Array<{ relationshipId?: string }>,
): RelationshipOption[] {
  const usedFatherMotherIds = new Set(
    savedCompanions
      .map((c) => String(c.relationshipId ?? "").trim())
      .filter((id) => {
        const opt = options.find((o) => String(o.value).trim() === id);
        return opt != null && isFatherMotherRelationship(opt.label);
      }),
  );

  return options.filter((o) => {
    if (!isFatherMotherRelationship(o.label)) return true;
    return !usedFatherMotherIds.has(String(o.value).trim());
  });
}

export function filterRelationshipOptionsForEditCompanion(
  options: RelationshipOption[],
  savedCompanions: Array<{ id?: string; relationshipId?: string }>,
  editingCompanionId?: string,
): RelationshipOption[] {
  return options.filter((o) => {
    if (!isFatherMotherRelationship(o.label)) return true;
    const value = String(o.value).trim();
    return !savedCompanions.some(
      (c) =>
        c.id !== editingCompanionId &&
        String(c.relationshipId ?? "").trim() === value,
    );
  });
}

export function isFatherMotherRelationshipTaken(
  relationshipId: string,
  options: RelationshipOption[],
  savedCompanions: Array<{ id?: string; relationshipId?: string }>,
  excludeCompanionId?: string,
): boolean {
  const id = String(relationshipId ?? "").trim();
  const opt = options.find((o) => String(o.value).trim() === id);
  if (!opt || !isFatherMotherRelationship(opt.label)) return false;
  return savedCompanions.some(
    (c) =>
      c.id !== excludeCompanionId &&
      String(c.relationshipId ?? "").trim() === id,
  );
}

/** بطاقة شخصية / شهادة ميلاد: birth date is parsed from the 14-digit national ID. */
export function documentTypeDerivesBirthDate(documentType: DocumentType): boolean {
  return documentType === "IDCard" || documentType === "ResidencePermit";
}

/** Egyptian national ID positions 1–7 encode century + YYMMDD. */
export function birthDateFromEgyptianNationalId(
  nationalId: string,
): Date | undefined {
  const digits = nationalId.replace(/\D/g, "");
  if (digits.length !== 14) return undefined;

  const centuryDigit = Number(digits[0]);
  const yy = Number(digits.slice(1, 3));
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));

  let year: number | undefined;
  if (centuryDigit === 2) year = 1900 + yy;
  else if (centuryDigit === 3 || centuryDigit === 4) year = 2000 + yy;
  else return undefined;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Extract string id from typical SonoBooking `IFinalResult` payloads. */
export function extractApiResultString(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;
  const o = response as Record<string, unknown>;
  const idTop = o.id ?? o.Id;
  if (typeof idTop === "string" && idTop.trim()) return idTop.trim();
  const payload = o.result ?? o.Result ?? o.data ?? o.Data;
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object") {
    const inner = payload as Record<string, unknown>;
    const id = inner.id ?? inner.Id ?? inner.result ?? inner.Result;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return undefined;
}

/** Extract boolean from typical SonoBooking `IFinalResult` payloads. */
export function extractApiResultBoolean(response: unknown): boolean | undefined {
  if (!response || typeof response !== "object") return undefined;
  const o = response as Record<string, unknown>;
  const payload = o.result ?? o.Result ?? o.data ?? o.Data;
  if (typeof payload === "boolean") return payload;
  return undefined;
}

export type NationalIdCheckPayload = {
  exists: boolean;
  isEmployee?: boolean;
  employeeId?: string;
};

/** Parse national-id check result (boolean legacy or structured payload). */
export function extractNationalIdCheckResult(
  response: unknown,
): NationalIdCheckPayload {
  if (!response || typeof response !== "object") {
    return { exists: false };
  }

  const o = response as Record<string, unknown>;
  const payload = o.result ?? o.Result ?? o.data ?? o.Data;

  if (typeof payload === "boolean") {
    return { exists: payload };
  }

  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const employeeId = p.employeeId ?? p.EmployeeId;
    const isEmployee = p.isEmployee ?? p.IsEmployee;
    return {
      exists: Boolean(p.exists ?? p.Exists),
      isEmployee:
        typeof isEmployee === "boolean"
          ? isEmployee
          : employeeId != null && String(employeeId).trim() !== "",
      employeeId:
        employeeId != null && String(employeeId).trim() !== ""
          ? String(employeeId)
          : undefined,
    };
  }

  return { exists: extractApiResultBoolean(response) ?? false };
}

export const NATIONAL_ID_EXISTED_MESSAGE =
  "رقم الهوية / المستند مسجل مسبقاً";

export const EMAIL_EXISTED_MESSAGE = "البريد الإلكتروني مسجل مسبقاً";

export const NOT_EMPLOYEE_MESSAGE =
  "رقم الهوية غير مسجل كموظف فى النظام";

export function mapRegisterApiMessage(
  message: string | undefined,
  status?: number,
  fallback = "حدث خطأ أثناء إكمال التسجيل",
): string {
  const code = (message ?? "").trim().toUpperCase();
  if (code === "NATIONAL_ID_EXISTED") return NATIONAL_ID_EXISTED_MESSAGE;
  if (code === "EMAIL_EXISTED") return EMAIL_EXISTED_MESSAGE;
  if (code === "NOT_EMPLOYEE") return NOT_EMPLOYEE_MESSAGE;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (status === 409) return "البيانات مسجلة مسبقاً";
  if (status === 400) return "بيانات غير صحيحة";
  return fallback;
}

/** 13th digit (before last): odd = male, even = female. */
function genderDigitFromNationalId(nationalId: string): number | undefined {
  const digits = nationalId.replace(/\D/g, "");
  if (digits.length < 13) return undefined;
  const digit = Number(digits[12]);
  return Number.isNaN(digit) ? undefined : digit;
}

/** For react-hook-form (`male` / `female`). */
export function genderFormValueFromNationalId(
  nationalId: string,
): "male" | "female" | undefined {
  const digit = genderDigitFromNationalId(nationalId);
  if (digit === undefined) return undefined;
  return digit % 2 === 0 ? "female" : "male";
}

/** Egyptian national ID: 13th digit odd = male, even = female (backend enum 1/2). */
export function genderFromNationalId(nationalId: string): 1 | 2 {
  const digit = genderDigitFromNationalId(nationalId);
  if (digit === undefined) return 1;
  return digit % 2 === 1 ? 1 : 2;
}

export function genderFormValueFromApi(gender: unknown): "male" | "female" {
  if (gender === 2 || gender === "2" || gender === "female") return "female";
  if (gender === 1 || gender === "1" || gender === "male") return "male";
  return "male";
}

export function genderToApiNumber(gender: "male" | "female"): 1 | 2 {
  return gender === "female" ? 2 : 1;
}

/** Backend `Gender` enum for multipart register / companion APIs. */
export function genderToApiString(gender: "male" | "female"): "Male" | "Female" {
  return gender === "female" ? "Female" : "Male";
}

export function parseBirthDateValue(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const t = value.trim();
    const match = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const d = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}

export function mapCompanionDtoToFormEntry(
  item: Record<string, unknown>,
): {
  id?: string;
  relationshipId: string;
  fullName: string;
  documentType: DocumentType;
  nationalId: string;
  gender: "male" | "female";
  birthDate: Date;
  documentImageUrl?: string;
  identityAttachment?: File;
} {
  const birthDate =
    parseBirthDateValue(item.birthDate ?? item.BirthDate) ??
    (undefined as unknown as Date);

  return {
    id: String(item.id ?? item.Id ?? "").trim() || undefined,
    relationshipId: String(
      item.relationshipId ?? item.RelationshipId ?? "",
    ).trim(),
    fullName: String(item.fullName ?? item.FullName ?? "").trim(),
    documentType: documentTypeFromApiValue(
      item.documentType ?? item.DocumentType,
    ),
    nationalId: String(
      item.documentNumber ?? item.DocumentNumber ?? "",
    ).trim(),
    gender: genderFormValueFromApi(item.gender ?? item.Gender),
    birthDate,
    documentImageUrl: String(
      item.documentImageUrl ?? item.DocumentImageUrl ?? "",
    ).trim() || undefined,
  };
}
