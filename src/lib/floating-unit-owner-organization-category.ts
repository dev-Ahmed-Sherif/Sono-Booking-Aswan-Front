import { getOrganizationCategories } from "@/actions/settings/organizationCategoryService";

/**
 * Resolves the organization category id used for owning companies linked to floating units
 * (same idea as marina category for tourist-marina organizations).
 */
export async function resolveFloatingUnitOwnerOrganizationCategoryId(): Promise<string> {
  const catRes = await getOrganizationCategories();
  if (!catRes || (catRes as { error?: string }).error) return "";
  const catRaw = ((catRes as { data?: unknown }).data ?? catRes) as unknown;
  if (!Array.isArray(catRaw)) return "";
  const found = catRaw
    .map((x) => x as Record<string, unknown>)
    .find((item) => {
      const nameAr = typeof item.nameAr === "string" ? item.nameAr.trim() : "";
      const nameEn = typeof item.nameEn === "string" ? item.nameEn.trim() : "";
      const lower = `${nameAr} ${nameEn}`.toLowerCase();
      return (
        nameAr.includes("عائم") ||
        nameAr.includes("وحدة عائمة") ||
        nameAr.includes("وحدات عائمة") ||
        lower.includes("floating") ||
        lower.includes("floating unit") ||
        lower.includes("floatingunit")
      );
    });
  return found && typeof found.id === "string" ? found.id : "";
}
