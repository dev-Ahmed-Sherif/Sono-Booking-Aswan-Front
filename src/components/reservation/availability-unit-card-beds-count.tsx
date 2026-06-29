import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardBedsCountProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardBedsCount({
  card,
}: AvailabilityUnitCardBedsCountProps) {
  const showBedCounts =
    card.unitKind === "room" || card.unitKind === "apartment";

  if (!showBedCounts) {
    return null;
  }

  const availableN = card.availableBedsCountLabel
    ? Number(card.availableBedsCountLabel)
    : 0;
  const unavailableN = card.unavailableBedsCountLabel
    ? Number(card.unavailableBedsCountLabel)
    : 0;
  const totalN =
    Number.isFinite(availableN) && Number.isFinite(unavailableN)
      ? availableN + unavailableN
      : null;

  if (totalN == null || totalN <= 0) {
    return null;
  }

  return (
    <p className="text-base font-bold leading-snug text-slate-800">
      <span className="font-semibold text-slate-600">عدد الأسرة: </span>
      <span className="text-lg font-extrabold tabular-nums text-slate-900">
        {totalN.toLocaleString("ar-EG")}
      </span>
    </p>
  );
}
