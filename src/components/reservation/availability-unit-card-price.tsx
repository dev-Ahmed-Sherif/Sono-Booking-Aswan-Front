import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardPriceProps = {
  card: AvailabilityUnitCard;
  className?: string;
};

export function AvailabilityUnitCardPrice({
  card,
  className,
}: AvailabilityUnitCardPriceProps) {
  if (!card.priceLabel) return null;

  return (
    <p
      className={`text-base font-bold leading-tight text-emerald-700 tabular-nums ${className ?? ""}`}
    >
      <span className="font-semibold text-slate-600">السعر: </span>
      {card.priceLabel}
    </p>
  );
}
