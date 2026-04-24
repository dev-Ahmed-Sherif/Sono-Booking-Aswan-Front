import { getOperatingCompanyById } from "@/actions/basic-data/operatingCompanyService";
import { getOrganizationStaffs } from "@/actions/basic-data/organizationStaffService";
import { getNationalities } from "@/actions/settings/nationalityService";
import OperatingCompaniesForm from "@/components/basic-data/operating-companies/operating-companies-form";
import type { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";

type PageProps = { params: { locale: string; id: string } };

const OperatingCompanyIdPage = async ({ params }: PageProps) => {
  const { id } = params;
  let initialData: unknown = null;
  let staffData: EmployeeOrganizationColumn[] | null = null;
  let nationalitiesData: Array<{
    id: string;
    nameAr: string;
    nameEn?: string;
  }> | null = null;

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

  if (id && id !== "new") {
    const result = await getOperatingCompanyById(id);
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
          <OperatingCompaniesForm
            initialData={initialData}
            name="شركة التشغيل / المسؤلين"
            staffData={staffData}
            nationalitiesData={nationalitiesData}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};
export default OperatingCompanyIdPage;
