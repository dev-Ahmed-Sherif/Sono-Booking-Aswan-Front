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

type WallTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readTimeZoneParts(date: Date, timeZone: string): WallTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function wallTimeToUtcMs(parts: WallTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** Converts a Cairo wall-clock datetime to the matching UTC instant. */
function cairoWallTimeToDate(parts: WallTimeParts): Date {
  let utcMs = wallTimeToUtcMs(parts);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inCairo = readTimeZoneParts(new Date(utcMs), EGYPT_TIME_ZONE);
    const diff = wallTimeToUtcMs(parts) - wallTimeToUtcMs(inCairo);
    if (diff === 0) break;
    utcMs += diff;
  }

  return new Date(utcMs);
}

function parseUnzonedBackendDateTime(raw: string): Date | null {
  const normalized = raw.trim().replace(" ", "T");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );
  if (!match) return null;

  return cairoWallTimeToDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  });
}

/**
 * Parses backend timestamps.
 * - Values with `Z` / offset are treated as absolute UTC/offset instants.
 * - Unzoned `yyyy-MM-dd HH:mm:ss` values are treated as Egypt local wall time
 *   (matches SQL Server `datetime` from `getdate()` / reception check-in saves).
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
  if (hasZone) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const cairoLocal = parseUnzonedBackendDateTime(raw);
  if (cairoLocal) return cairoLocal;

  const date = new Date(raw);
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
