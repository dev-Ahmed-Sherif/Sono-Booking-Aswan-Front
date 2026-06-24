import { formatHousingGenderLabel } from "@/lib/housing-gender-label";

export type ApartmentSummary = {
  apartmentNumber: string;
  genderLabel: string;
};

export function mapApiApartmentSummary(
  api: Record<string, unknown>,
): ApartmentSummary {
  const apartmentNumber = String(
    api.apartmentNumber ?? api.ApartmentNumber ?? "",
  ).trim();

  const genderRaw = api.gender ?? api.Gender;
  const genderLabel =
    genderRaw === 1 || genderRaw === "1"
      ? "رجال"
      : genderRaw === 2 || genderRaw === "2"
        ? "سيدات"
        : formatHousingGenderLabel(String(genderRaw ?? ""));

  return { apartmentNumber, genderLabel };
}
