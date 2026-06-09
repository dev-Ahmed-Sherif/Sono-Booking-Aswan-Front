import { toYmd } from "@/lib/housing-request-list";

export type AvailabilityInquiryGender = "male" | "female";

export type AvailabilityInquiryDates = {
  startDateYmd: string;
  nights?: number;
  /** Selected genders from the inquiry form (maps to apartment `Gender`). */
  genders?: AvailabilityInquiryGender[];
};

/** HTTP `Gender` header for Beds/Rooms/Apartments getAll (comma-separated). */
export function formatAvailabilityGenderHeader(
  genders: AvailabilityInquiryGender[] | undefined,
): string | undefined {
  if (!genders?.length) return undefined;
  const tokens = [
    ...new Set(
      genders
        .filter((g): g is AvailabilityInquiryGender => g === "male" || g === "female")
        .map((g) => (g === "male" ? "Male" : "Female")),
    ),
  ];
  return tokens.length > 0 ? tokens.join(",") : undefined;
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Normalize inquiry start to `yyyy-MM-dd` (from `<input type="date">` or `Date`). */
export function normalizeInquiryStartYmd(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toYmd(value);
  }
  return toYmd(value);
}

export function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function maxYmd(
  ...values: Array<string | undefined>
): string | undefined {
  let best: string | undefined;
  for (const v of values) {
    if (!v) continue;
    if (!best || compareYmd(v, best) > 0) best = v;
  }
  return best;
}

function endYmdFromRecord(r: Record<string, unknown>): string | undefined {
  return toYmd(
    r.endDate ??
      r.EndDate ??
      r.extensionEndDate ??
      r.ExtensionEndDate ??
      r.requestEndDate ??
      r.RequestEndDate ??
      r.newEndDate ??
      r.NewEndDate,
  );
}

/**
 * Latest blocking end date on a unit row (request / extension), if the API sends it.
 */
export function extractBlockingEndYmdFromUnitRow(
  item: unknown,
): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const r = item as Record<string, unknown>;

  const direct = maxYmd(
    toYmd(
      pickStr(
        r,
        "extensionEndDate",
        "ExtensionEndDate",
        "requestEndDate",
        "RequestEndDate",
        "endDate",
        "EndDate",
        "availableTo",
        "AvailableTo",
        "blockedUntil",
        "BlockedUntil",
        "occupiedUntil",
        "OccupiedUntil",
      ),
    ),
  );

  const nestedEnds: string[] = [];
  for (const key of [
    "request",
    "Request",
    "extension",
    "Extension",
    "activeRequest",
    "ActiveRequest",
    "currentRequest",
    "CurrentRequest",
  ]) {
    const nested = r[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const end = endYmdFromRecord(nested as Record<string, unknown>);
      if (end) nestedEnds.push(end);
    }
  }

  return maxYmd(direct, ...nestedEnds);
}

function isReservedOrOccupiedCatalogStatus(status: unknown): boolean {
  if (status == null) return false;
  const n = typeof status === "number" ? status : Number(String(status).trim());
  if (Number.isFinite(n)) return n === 2 || n === 3;
  const t = String(status).trim().toLowerCase();
  return (
    t.includes("reserv") ||
    t.includes("occup") ||
    t === "محجوز" ||
    t === "مشغول"
  );
}

/**
 * Unit is bookable when inquiry start is strictly after the last request/extension end
 * (unit becomes free after that date).
 */
export function isUnitFreeFromInquiryStart(
  inquiryStartYmd: string | undefined,
  ...args: Array<string | undefined | unknown>
): boolean {
  if (!inquiryStartYmd) return true;

  let catalogStatus: unknown;
  const blockingEndDates: Array<string | undefined> = [];
  for (const arg of args) {
    if (typeof arg === "string" || arg === undefined) {
      blockingEndDates.push(arg);
    } else if (blockingEndDates.length > 0 && catalogStatus === undefined) {
      catalogStatus = arg;
    }
  }

  const blockingEnd = maxYmd(...blockingEndDates);
  if (isReservedOrOccupiedCatalogStatus(catalogStatus) && !blockingEnd) {
    return false;
  }
  if (!blockingEnd) return true;
  return compareYmd(inquiryStartYmd, blockingEnd) > 0;
}

export function filterUnitsByInquiryStartDate(
  units: unknown[],
  inquiryStartYmd: string | undefined,
  extraBlockingEndsForRow?: (row: Record<string, unknown>) => string | undefined,
): unknown[] {
  if (!inquiryStartYmd) return units;

  return units.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const rowEnd = extractBlockingEndYmdFromUnitRow(row);
    const extraEnd = extraBlockingEndsForRow?.(row);
    return isUnitFreeFromInquiryStart(
      inquiryStartYmd,
      rowEnd,
      extraEnd,
      row.status ?? row.Status,
    );
  });
}
