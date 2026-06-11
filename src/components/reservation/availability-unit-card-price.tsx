import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardPriceProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardPrice({ card }: AvailabilityUnitCardPriceProps) {
  if (!card.priceLabel) return null;

  return (
    <p className="text-lg font-extrabold leading-snug text-emerald-700 tabular-nums">
      <span className="text-base font-semibold text-slate-600">السعر: </span>
      {card.priceLabel}
    </p>
  );
}
