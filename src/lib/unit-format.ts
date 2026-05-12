/**
 * Display helpers for unit (apartment / room / bed) tables.
 * Centralized so the standalone `columns.tsx` files and the inline column
 * definitions inside the unit forms stay in sync.
 */

const ARABIC_DIGIT_MAP: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
};

/**
 * Convert all ASCII digits in a value to Arabic-Indic digits (٠-٩).
 * - Returns `"-"` for null/undefined/empty values.
 * - Preserves non-digit characters (letters, punctuation, separators).
 * - For finite numbers, uses `toLocaleString("ar-EG")` so thousands
 *   separators / fractional digits are localized correctly.
 */
export function toArabicDigits(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    return value.toLocaleString("ar-EG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  const str = String(value);
  if (str.trim() === "") return "-";
  const numeric = Number(str);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(str.trim())) {
    return numeric.toLocaleString("ar-EG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return str.replace(/[0-9]/g, (d) => ARABIC_DIGIT_MAP[d] ?? d);
}

/**
 * Localize a unit status to Arabic, regardless of the form
 * the backend returns it in (enum id, English name, or already Arabic).
 */
export function localizeUnitStatus(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const key = String(value).trim();
  if (key === "") return "-";
  const map: Record<string, string> = {
    "1": "متاح",
    "2": "محجوز",
    "3": "مشغول",
    Available: "متاح",
    Reserved: "محجوز",
    Occupied: "مشغول",
    AVAILABLE: "متاح",
    RESERVED: "محجوز",
    OCCUPIED: "مشغول",
    متاح: "متاح",
    محجوز: "محجوز",
    مشغول: "مشغول",
    متاحة: "متاح",
    محجوزة: "محجوز",
    مشغولة: "مشغول",
  };
  return map[key] ?? key;
}
