import { ar, enUS, fr, it, type Locale } from "date-fns/locale";

export function isRtlLocale(locale: string): boolean {
  return locale === "ar" || locale.startsWith("ar-");
}

export function getDateFnsLocale(locale: string): Locale {
  if (isRtlLocale(locale)) return ar;
  if (locale === "fr") return fr;
  if (locale === "it") return it;
  return enUS;
}

export function getNumberFormatLocale(locale: string): string {
  if (isRtlLocale(locale)) return "ar-EG";
  return locale;
}

export {
  EGYPT_LOCALE,
  EGYPT_TIME_ZONE,
  formatUtcToCairo,
  formatUtcToCairoDate,
  formatUtcToCairoShortDate,
  formatUtcToCairoTime,
  parseUtcDate,
  todayYmdCairo,
} from "@/lib/date-timeOptions";

export function formatLocaleNumber(value: number, locale: string): string {
  return value.toLocaleString(getNumberFormatLocale(locale));
}
