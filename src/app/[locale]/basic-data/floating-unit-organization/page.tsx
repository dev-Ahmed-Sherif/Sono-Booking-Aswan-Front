import dynamic from "next/dynamic";
import { getFloatingUnitOrganizations } from "@/actions/basic-data/floatingUnitOrganizationService";
import type { FloatingUnitOrganizationColumn } from "@/components/basic-data/floating-unit-organization/columns";
import { mapApiListToFloatingUnitOrganizationColumns } from "@/lib/floating-unit-organization-map";

const FloatingUnitOrganizationClient = dynamic(
  () => import("@/components/basic-data/floating-unit-organization/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

const FloatingUnitOrganizationPage = async () => {
  let data: FloatingUnitOrganizationColumn[] | null = null;
  const result = await getFloatingUnitOrganizations();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = mapApiListToFloatingUnitOrganizationColumns(raw);
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <FloatingUnitOrganizationClient data={data} />
        </div>
      </div>
    </main>
  );
};
export default FloatingUnitOrganizationPage;
