/** Housing unit gender labels shown in apartment/unit forms (not person registration). */
export function formatHousingGenderLabel(
  nameAr: string | null | undefined,
  nameEn?: string | null,
): string {
  const ar = String(nameAr ?? "").trim();
  const arLower = ar.toLowerCase();
  const en = String(nameEn ?? "")
    .trim()
    .toLowerCase();

  if (
    ar === "ذكر" ||
    ar === "رجال" ||
    arLower === "male" ||
    en === "male"
  ) {
    return "رجال";
  }
  if (
    ar === "أنثى" ||
    ar === "انثى" ||
    ar === "سيدات" ||
    arLower === "female" ||
    en === "female"
  ) {
    return "سيدات";
  }

  return ar || String(nameEn ?? "").trim();
}
