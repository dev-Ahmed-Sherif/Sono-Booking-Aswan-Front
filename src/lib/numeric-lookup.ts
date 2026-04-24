/** Lookup row with numeric id (e.g. enum / reference data from API). */
export type NumericLookupRow = {
  id: number;
  nameAr: string;
  nameEn?: string;
};

/**
 * Normalizes common API shapes: `id`/`Id`/`value`/`Value`, `nameAr`/`NameAr`/`name`/`Name`.
 */
export function normalizeNumericLookupList(raw: unknown): NumericLookupRow[] {
  if (!Array.isArray(raw)) return [];
  const out: NumericLookupRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const idRaw = o.id ?? o.Id ?? o.value ?? o.Value;
    const id =
      typeof idRaw === "number" && Number.isFinite(idRaw)
        ? idRaw
        : typeof idRaw === "string" && idRaw.trim() !== ""
          ? Number(idRaw)
          : NaN;
    if (!Number.isFinite(id)) continue;
    const nameAr = String(
      o.nameAr ?? o.NameAr ?? o.name ?? o.Name ?? "",
    ).trim();
    if (!nameAr) continue;
    const nameEnRaw = o.nameEn ?? o.NameEn;
    out.push({
      id,
      nameAr,
      nameEn:
        typeof nameEnRaw === "string" && nameEnRaw.trim()
          ? nameEnRaw.trim()
          : undefined,
    });
  }
  return out;
}

/** Pick a valid id from list, or first row, or `hardFallback` when list is empty. */
export function resolveNumericLookupId(
  v: unknown,
  list: NumericLookupRow[] | null | undefined,
  hardFallback: number,
): number {
  const n =
    typeof v === "number" && Number.isFinite(v)
      ? v
      : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))
        ? Number(v)
        : NaN;
  const allowed = list ?? [];
  if (Number.isFinite(n) && allowed.some((x) => x.id === n)) return n;
  if (allowed.length > 0) return allowed[0].id;
  return hardFallback;
}
