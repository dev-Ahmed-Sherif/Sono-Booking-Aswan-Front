import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

type AvailabilityUnitCardParentsProps = {
  card: AvailabilityUnitCard;
};

export function AvailabilityUnitCardParents({
  card,
}: AvailabilityUnitCardParentsProps) {
  if (!card.parentRoomLabel && !card.parentApartmentLabel) return null;

  return (
    <div className="space-y-1 text-base font-semibold leading-snug text-slate-800">
      {card.parentRoomLabel ? (
        <p>
          <span className="font-semibold text-slate-600">الغرفة: </span>
          <span className="text-lg font-bold text-slate-900">
            {card.parentRoomLabel}
          </span>
        </p>
      ) : null}
      {card.parentApartmentLabel ? (
        <p>
          <span className="font-semibold text-slate-600">الشقة: </span>
          <span className="text-lg font-bold text-slate-900">
            {card.parentApartmentLabel}
          </span>
        </p>
      ) : null}
    </div>
  );
}
