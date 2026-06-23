/** Egypt local time (UTC+2 winter / UTC+3 summer via IANA rules). */
export const EGYPT_TIME_ZONE = "Africa/Cairo";
export const EGYPT_LOCALE = "ar-EG";

export const cairoDateTimeOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: EGYPT_TIME_ZONE,
};

export const cairoDateOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "2-digit",
  timeZone: EGYPT_TIME_ZONE,
};

export const cairoTimeOptions: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: EGYPT_TIME_ZONE,
};

export const cairoShortDateOptions: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  timeZone: EGYPT_TIME_ZONE,
};

/** @deprecated Prefer `cairoDateTimeOptions`. */
export const options = cairoDateTimeOptions;

/**
 * Parse backend UTC timestamps safely, even when the string misses timezone suffix.
 */
export function parseUtcDate(
  dateValue: string | Date | null | undefined,
): Date | null {
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

function normalizeArabicFormattedDate(value: string): string {
  return value.replace(/،/g, " ").trim();
}

export function getCairoYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayYmdCairo(): string {
  return getCairoYmd(new Date());
}

export function addDaysToCairoYmd(ymd: string, days: number): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcNoon = Date.UTC(year, month - 1, day + days, 12, 0, 0);
  return getCairoYmd(new Date(utcNoon));
}

export function isCairoToday(
  dateValue: string | Date | null | undefined,
): boolean {
  const date = parseUtcDate(dateValue);
  if (!date) return false;
  return getCairoYmd(date) === todayYmdCairo();
}

export function isCairoYesterday(
  dateValue: string | Date | null | undefined,
): boolean {
  const date = parseUtcDate(dateValue);
  if (!date) return false;
  return getCairoYmd(date) === addDaysToCairoYmd(todayYmdCairo(), -1);
}

export function formatUtcToCairo(
  dateValue: string | Date | null | undefined,
): string {
  const date = parseUtcDate(dateValue);
  if (!date) return "-";
  return normalizeArabicFormattedDate(
    date.toLocaleString(EGYPT_LOCALE, cairoDateTimeOptions),
  );
}

export function formatUtcToCairoDate(
  dateValue: string | Date | null | undefined,
): string {
  const date = parseUtcDate(dateValue);
  if (!date) return "-";
  return normalizeArabicFormattedDate(
    date.toLocaleString(EGYPT_LOCALE, cairoDateOptions),
  );
}

export function formatUtcToCairoTime(
  dateValue: string | Date | null | undefined,
): string {
  const date = parseUtcDate(dateValue);
  if (!date) return "-";
  return normalizeArabicFormattedDate(
    date.toLocaleString(EGYPT_LOCALE, cairoTimeOptions),
  );
}

export function formatUtcToCairoShortDate(
  dateValue: string | Date | null | undefined,
): string {
  const date = parseUtcDate(dateValue);
  if (!date) return "-";
  return normalizeArabicFormattedDate(
    date.toLocaleString(EGYPT_LOCALE, cairoShortDateOptions),
  );
}
