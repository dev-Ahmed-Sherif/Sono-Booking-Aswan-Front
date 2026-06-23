import { addDays, format, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";

import { getAllowedDayBeforeReservations } from "@/actions/settings/allowedDayBeforeReservationService";
import { getLookupArray } from "@/lib/availability-inquiry";

export type AllowedDayBeforeReservationRow = {
  numofDays?: number;
  NumofDays?: number;
  isDeleted?: boolean;
  IsDeleted?: boolean;
};

export function sumAllowedDaysBeforeReservation(
  rows: AllowedDayBeforeReservationRow[],
): number {
  return rows
    .filter((row) => row.isDeleted !== true && row.IsDeleted !== true)
    .reduce((sum, row) => {
      const value = Number(row.numofDays ?? row.NumofDays ?? 0);
      if (!Number.isFinite(value) || value <= 0) return sum;
      return sum + Math.floor(value);
    }, 0);
}

export function minReservationStartDateFromOffset(
  daysOffset: number,
  baseDate: Date = new Date(),
): Date {
  const base = startOfDay(baseDate);
  const offset =
    Number.isFinite(daysOffset) && daysOffset > 0 ? Math.floor(daysOffset) : 0;
  return addDays(base, offset);
}

export function parseReservationStartDate(
  value: Date | string | undefined | null,
): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return startOfDay(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ymd = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function isReservationStartDateAllowed(
  value: Date | string | undefined | null,
  minDate: Date,
): boolean {
  const selected = parseReservationStartDate(value);
  if (!selected) return false;
  return selected.getTime() >= startOfDay(minDate).getTime();
}

export function formatMinReservationStartMessage(minDate: Date): string {
  return `أقرب تاريخ مسموح للحجز هو ${format(minDate, "PPP", { locale: ar })}`;
}

export async function fetchAllowedDaysBeforeReservationOffset(): Promise<number> {
  try {
    const response = await getAllowedDayBeforeReservations();
    if (response && typeof response === "object" && "error" in response && response.error) {
      return 0;
    }
    const rows = getLookupArray(response) as AllowedDayBeforeReservationRow[];
    return sumAllowedDaysBeforeReservation(rows);
  } catch {
    return 0;
  }
}
