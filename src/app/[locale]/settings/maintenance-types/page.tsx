import dynamic from "next/dynamic";

import { getMaintenanceTypes } from "@/actions/settings/maintenanceTypeService";
import type { MaintenanceTypeColumn } from "@/components/settings/maintenance-types/columns";

const MaintenanceTypesClient = dynamic(
  () => import("@/components/settings/maintenance-types/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type PageProps = {
  params: { locale: string };
};

const MaintenanceTypesPage = async ({ params }: PageProps) => {
  const { locale } = params;

  let data: MaintenanceTypeColumn[] | null = null;
  const result = await getMaintenanceTypes();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as MaintenanceTypeColumn[]) : null;
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <MaintenanceTypesClient
          data={data}
          path={`/${locale}/settings/maintenance-types/new`}
        />
      </div>
    </main>
  );
};

export default MaintenanceTypesPage;
