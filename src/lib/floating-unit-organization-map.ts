import type { FloatingUnitOrganizationColumn } from "@/components/basic-data/floating-unit-organization/columns";

function organizationTypeFromRow(r: Record<string, unknown>): {
  organizationTypeId?: number;
  organizationTypeCode?: string;
} {
  const raw = r.organizationType ?? r.OrganizationType;
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.Id;
  const n = typeof idRaw === "number" ? idRaw : Number(idRaw);
  const codeRaw = o.code ?? o.Code;
  const code = typeof codeRaw === "string" ? codeRaw : "";
  return {
    organizationTypeId: Number.isFinite(n) ? n : undefined,
    organizationTypeCode: code,
  };
}

/** Rows linked to owner companies vs operating companies (by API enum). */
export function filterFloatingUnitOrganizationsBySource(
  rows: FloatingUnitOrganizationColumn[],
  source: "owner" | "operating",
): FloatingUnitOrganizationColumn[] {
  const norm = (code: string | undefined) =>
    (code ?? "").toLowerCase().replace(/_/g, "");
  return rows.filter((r) => {
    const code = norm(r.organizationTypeCode);
    if (source === "owner") {
      return r.organizationTypeId === 1 || code === "ownercompany";
    }
    return r.organizationTypeId === 2 || code === "operatingcompany";
  });
}

/** Normalizes IFinalResult / array payloads from `getFloatingUnitOrganizations`. */
export function mapApiListToFloatingUnitOrganizationColumns(
  payload: unknown,
): FloatingUnitOrganizationColumn[] {
  let list: unknown[] | null = null;
  if (Array.isArray(payload)) list = payload;
  else if (payload && typeof payload === "object") {
    const top = (payload as { data?: unknown }).data;
    if (Array.isArray(top)) list = top;
    else if (
      top &&
      typeof top === "object" &&
      Array.isArray((top as { data?: unknown }).data)
    ) {
      list = (top as { data: unknown[] }).data;
    }
  }
  if (!list) return [];
  return list.map((x) => {
    const r = x as Record<string, unknown>;
    const typeFields = organizationTypeFromRow(r);
    return {
      id: String(r.id ?? r.Id ?? ""),
      organizationId: String(
        r.organizationId ?? r.OrganizationId ?? "",
      ),
      organizationNameAr: String(
        r.organizationNameAr ?? r.OrganizationNameAr ?? "",
      ),
      floatingUnitId: String(r.floatingUnitId ?? r.FloatingUnitId ?? ""),
      floatingUnitNameAr: String(
        r.floatingUnitNameAr ?? r.FloatingUnitNameAr ?? "",
      ),
      ...typeFields,
      isDeleted: Boolean(r.isDeleted ?? r.IsDeleted),
    };
  });
}
