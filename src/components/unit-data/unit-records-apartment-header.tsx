import { toArabicDigits } from "@/lib/unit-format";
import { formatHousingGenderLabel } from "@/lib/housing-gender-label";

type UnitRecordsApartmentHeaderProps = {
  /** e.g. "قائمة الغرف" or "قائمة الأسرة" */
  listLabel: string;
  apartmentNumber?: string;
  genderLabel?: string;
};

export default function UnitRecordsApartmentHeader({
  listLabel,
  apartmentNumber,
  genderLabel,
}: UnitRecordsApartmentHeaderProps) {
  const label = String(listLabel ?? "").trim();
  const number = String(apartmentNumber ?? "").trim();
  const gender = formatHousingGenderLabel(String(genderLabel ?? "").trim());

  if (!label && !number && !gender) return null;

  let title = label || "القائمة";
  if (number) {
    title += ` بالشقة رقم ${toArabicDigits(number)}`;
  }
  if (gender) {
    title += ` - ${gender}`;
  }

  return (
    <h3 className="mb-4 text-center text-xl font-bold leading-relaxed">
      {title}
    </h3>
  );
}
