import dynamic from "next/dynamic";
import { getOwningCompanies } from "@/actions/basic-data/owningCompanyService";
import { getOrganizationCategoryById } from "@/actions/settings/organizationCategoryService";
import type { OwningCompanyColumn } from "@/components/basic-data/owning-companies/columns";

const OwningCompaniesClient = dynamic(
  () => import("@/components/basic-data/owning-companies/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type PageProps = { params: { locale: string; categoryId: string } };

const OwningCompaniesListPage = async ({ params }: PageProps) => {
  const { locale, categoryId } = params;
  let data: OwningCompanyColumn[] | null = null;
  let showFloatingRequirementsColumn = false;
  let showTouristMarinasColumn = false;
  const result = await getOwningCompanies(categoryId, "OwnerCompany");
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as OwningCompanyColumn[]) : null;
  }
  const categoryResult = await getOrganizationCategoryById(categoryId);
  if (categoryResult && !(categoryResult as { error?: string }).error) {
    const rawCategory =
      (categoryResult as { data?: unknown }).data ?? categoryResult;
    if (rawCategory && typeof rawCategory === "object") {
      const categoryObj = rawCategory as { nameAr?: string; nameEn?: string };
      const rawName =
        categoryObj.nameAr?.trim() || categoryObj.nameEn?.trim() || "";
      const lower = rawName.toLowerCase();
      const compact = lower.replace(/\s+/g, "");
      showFloatingRequirementsColumn =
        rawName.includes("عائمات") ||
        rawName.includes("عائمة") ||
        lower.includes("floating units") ||
        lower.includes("floatingunit") ||
        compact.includes("floatingunits");
      showTouristMarinasColumn =
        rawName.includes("مراسى") ||
        rawName.includes("مراسي") ||
        lower.includes("marina");
    }
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <OwningCompaniesClient
            data={data}
            organizationCategoryId={categoryId}
            showFloatingRequirementsColumn={showFloatingRequirementsColumn}
            showTouristMarinasColumn={showTouristMarinasColumn}
            locale={locale}
          />
        </div>
      </div>
    </main>
  );
};
export default OwningCompaniesListPage;
