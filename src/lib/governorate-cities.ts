/** Normalizes city list API payloads for governorate detail UI. */

export type GovernorateCityRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
};

/** City row including governorate id (e.g. global city list). */
export type CityListRow = GovernorateCityRow & {
  governorateId?: string;
  isDeleted?: boolean;
};

function extractCityArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data: unknown }).data)
  ) {
    return (raw as { data: unknown[] }).data;
  }
  return [];
}

function mapRecordToCityListRow(x: Record<string, unknown>): CityListRow {
  const gid =
    x.governorateId != null
      ? String(x.governorateId)
      : x.GovernorateId != null
        ? String(x.GovernorateId)
        : x.GovernateId != null
          ? String(x.GovernateId)
          : x.governateId != null
            ? String(x.governateId)
            : undefined;
  return {
    id: String(x.id ?? x.Id ?? ""),
    code: String(x.code ?? x.Code ?? "1"),
    nameAr: String(x.nameAr ?? x.NameAr ?? ""),
    nameEn:
      x.nameEn != null
        ? String(x.nameEn)
        : x.NameEn != null
          ? String(x.NameEn)
          : undefined,
    governorateId: gid,
  };
}

/** All cities from API (no governorate filter). */
export function normalizeAllCitiesResponse(raw: unknown): CityListRow[] {
  const list = extractCityArray(raw);
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map(mapRecordToCityListRow)
    .filter((c) => Boolean(c.id));
}

export function normalizeGovernorateCitiesResponse(
  raw: unknown,
  governorateId: string,
): GovernorateCityRow[] {
  const list = extractCityArray(raw);
  if (!Array.isArray(list)) return [];

  return list
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map(mapRecordToCityListRow)
    .filter(
      (c) =>
        c.id &&
        (!c.governorateId || c.governorateId === String(governorateId)),
    )
    .map(({ governorateId: _g, ...row }) => row);
}
