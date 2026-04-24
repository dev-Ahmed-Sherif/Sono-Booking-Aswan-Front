import { getOwningCompanyById } from "@/actions/basic-data/owningCompanyService";
import { getOrganizationStaffs } from "@/actions/basic-data/organizationStaffService";
import { getNationalities } from "@/actions/settings/nationalityService";
import { getOrganizationCategoryById } from "@/actions/settings/organizationCategoryService";
import OwningCompaniesForm from "@/components/basic-data/owning-companies/owning-companies-form";
import type { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";

type PageProps = { params: { locale: string; categoryId: string; id: string } };

const OwningCompanyIdPage = async ({ params }: PageProps) => {
  const { categoryId, id } = params;
  let initialData: unknown = null;
  let staffData: EmployeeOrganizationColumn[] | null = null;
  let nationalitiesData: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null = null;
  let organizationCategoryName = "";

  const nationalitiesResult = await getNationalities();
  if (
    nationalitiesResult &&
    !(nationalitiesResult as { error?: string }).error
  ) {
    const rawNationalities =
      (nationalitiesResult as { data?: unknown }).data ?? nationalitiesResult;
    nationalitiesData = Array.isArray(rawNationalities)
      ? (rawNationalities as Array<{
          id: string;
          nameAr: string;
          nameEn?: string;
        }>)
      : null;
  }
  const categoryResult = await getOrganizationCategoryById(categoryId);
  if (categoryResult && !(categoryResult as { error?: string }).error) {
    const rawCategory =
      (categoryResult as { data?: unknown }).data ?? categoryResult;
    if (rawCategory && typeof rawCategory === "object") {
      const categoryObj = rawCategory as { nameAr?: string; nameEn?: string };
      organizationCategoryName =
        categoryObj.nameAr?.trim() || categoryObj.nameEn?.trim() || "";
    }
  }

  if (id && id !== "new") {
    const result = await getOwningCompanyById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
    const staffResult = await getOrganizationStaffs(id);
    if (staffResult && !(staffResult as { error?: string }).error) {
      const raw = (staffResult as { data?: unknown }).data ?? staffResult;
      staffData = Array.isArray(raw)
        ? (raw as EmployeeOrganizationColumn[])
        : null;
    }
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <OwningCompaniesForm
            initialData={initialData}
            name="الشركة المالكة / المسؤلين"
            organizationCategoryId={categoryId}
            organizationCategoryName={organizationCategoryName}
            staffData={staffData}
            nationalitiesData={nationalitiesData}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};
export default OwningCompanyIdPage;
