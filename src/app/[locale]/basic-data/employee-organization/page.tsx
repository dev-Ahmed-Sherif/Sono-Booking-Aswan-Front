import dynamic from "next/dynamic";
import { getOrganizationStaffs } from "@/actions/basic-data/organizationStaffService";
import type { EmployeeOrganizationColumn } from "@/components/basic-data/employee-organization/columns";

const EmployeeOrganizationClient = dynamic(
  () => import("@/components/basic-data/employee-organization/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type PageProps = { params: { locale: string } };

const EmployeeOrganizationPage = async ({ params }: PageProps) => {
  const { locale } = params;
  let data: EmployeeOrganizationColumn[] | null = null;
  const result = await getOrganizationStaffs();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as EmployeeOrganizationColumn[]) : null;
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <EmployeeOrganizationClient data={data} />
        </div>
      </div>
    </main>
  );
};
export default EmployeeOrganizationPage;
