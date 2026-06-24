import { toArabicDigits } from "@/lib/unit-format";
import { formatHousingGenderLabel } from "@/lib/housing-gender-label";

type UnitRecordsApartmentHeaderProps = {
  apartmentNumber?: string;
  genderLabel?: string;
};

export default function UnitRecordsApartmentHeader({
  apartmentNumber,
  genderLabel,
}: UnitRecordsApartmentHeaderProps) {
  const number = String(apartmentNumber ?? "").trim();
  const gender = formatHousingGenderLabel(String(genderLabel ?? "").trim());
  if (!number && !gender) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-lg">
      {number ? (
        <span>
          <span className="text-base text-muted-foreground">رقم الشقة: </span>
          <span className="text-xl font-bold">{toArabicDigits(number)}</span>
        </span>
      ) : null}
      {gender ? (
        <span>
          <span className="text-base text-muted-foreground">التخصيص: </span>
          <span className="text-xl font-bold">{gender}</span>
        </span>
      ) : null}
    </div>
  );
}
