import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardBedsCountProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardBedsCount({
  card,
}: AvailabilityUnitCardBedsCountProps) {
  const available = card.availableBedsCountLabel;
  const unavailable = card.unavailableBedsCountLabel;
  const allocationType = card.allocationTypeLabel;
  const showBedCounts =
    card.unitKind === "room" || card.unitKind === "apartment";

  if (
    !showBedCounts &&
    !allocationType
  ) {
    return null;
  }
  if (card.unitKind !== "room" && card.unitKind !== "apartment" && card.unitKind !== "bed") {
    return null;
  }

  const availableN = available ? Number(available) : 0;
  const unavailableN = unavailable ? Number(unavailable) : 0;
  const totalN =
    showBedCounts &&
    Number.isFinite(availableN) &&
    Number.isFinite(unavailableN)
      ? availableN + unavailableN
      : null;

  return (
    <div className="space-y-0.5 text-base font-bold leading-snug text-slate-800">
      {showBedCounts && available ? (
        <p>
          <span className="font-semibold text-slate-600">الأسرة المتاحة: </span>
          <span className="text-lg font-extrabold tabular-nums text-emerald-700">
            {available}
          </span>
        </p>
      ) : null}
      {showBedCounts && unavailable ? (
        <p>
          <span className="font-semibold text-slate-600">الأسرة غير المتاحة: </span>
          <span className="text-lg font-extrabold tabular-nums text-rose-700">
            {unavailable}
          </span>
        </p>
      ) : null}
      {showBedCounts && totalN != null ? (
        <p>
          <span className="font-semibold text-slate-600">إجمالي الأسرة: </span>
          <span className="text-lg font-extrabold tabular-nums text-slate-900">
            {totalN.toLocaleString("ar-EG")}
          </span>
        </p>
      ) : null}
      {allocationType ? (
        <p>
          <span className="font-semibold text-slate-600">نوع التخصيص: </span>
          <span className="text-lg font-extrabold tabular-nums text-indigo-700">
            {allocationType}
          </span>
        </p>
      ) : null}
    </div>
  );
}

