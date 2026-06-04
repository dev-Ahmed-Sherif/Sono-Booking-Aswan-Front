/** Final reservation amount after applying a percentage discount (0–100). */
export function computeFinalAmountAfterDiscount(
  baseAmount: number,
  discountPercent: number,
): number {
  const base = Number.isFinite(baseAmount) ? Math.max(0, baseAmount) : 0;
  const pct = Number.isFinite(discountPercent)
    ? Math.min(100, Math.max(0, discountPercent))
    : 0;
  const final = base * (1 - pct / 100);
  return Math.round(final * 100) / 100;
}

export function formatReservationAmountAr(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("ar-EG")} ج.م`;
}
