const noticeClassName =
  "rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-base leading-relaxed text-green-950";

type AllocationOption = { value: string; label: string };

/** Matches API labels: مرن، متحرك، Flexible, Movable, etc. */
function isFlexibleAllocationText(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();

  if (raw.includes("مرن") || raw.includes("متحرك")) return true;
  if (lower.includes("flex") || lower.includes("movable") || lower.includes("marun")) {
    return true;
  }

  // Fixed / ثابت — never flexible
  if (raw.includes("ثابت") || lower.includes("fixed")) return false;

  return false;
}

/** True when the selected booking type is flexible (مرن / متحرك / Movable). */
export function isFlexibleAllocationType(
  value: string,
  options: AllocationOption[],
): boolean {
  const selected = value.trim();
  if (!selected) return false;

  const opt = options.find(
    (o) => o.value.trim() === selected || o.label.trim() === selected,
  );

  const candidates = [opt?.label ?? "", opt?.value ?? "", selected];
  return candidates.some((text) => isFlexibleAllocationText(text));
}

export function FlexibleAllocationNotice() {
  return (
    <div className={noticeClassName} role="note">
      <ol className="list-decimal space-y-1.5 ps-5 marker:font-semibold">
        <li>مرن سيتم تغيير تاريخ الحجز زيادة / ناقص يوم و / أو تغيير رقم الوحدة</li>
        <li>ثابت سيتم التقييد بتاريخ الحجز ورقم الوحدة</li>
      </ol>
    </div>
  );
}

export function EmployeeDiscountNotice() {
  return (
    <div className={noticeClassName} role="note">
      <ol className="list-decimal ps-5 marker:font-semibold" start={3}>
        <li>قيمة الحجز خاضعة للخصم المقرر</li>
      </ol>
    </div>
  );
}
