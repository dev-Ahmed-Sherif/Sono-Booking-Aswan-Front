export const options: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  // Use fixed default timezone instead of device timezone.
  timeZone: "Africa/Cairo",
};

/**
 * Parse backend UTC timestamps safely, even when the string misses timezone suffix.
 */
export function parseUtcDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
  const raw = String(dateValue).trim();
  if (!raw) return null;
  const hasZone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasZone ? raw : `${raw}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUtcToCairo(
  dateValue: string | Date | null | undefined,
): string {
  const date = parseUtcDate(dateValue);
  if (!date) return "-";
  return date.toLocaleString("ar-EG", options);
}
