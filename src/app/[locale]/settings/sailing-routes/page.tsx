import dynamic from "next/dynamic";

import { getSailingRoutes } from "@/actions/settings/sailingRouteService";

import type { SailingRouteColumn } from "@/components/settings/sailing-routes/columns";

const SailingRoutesClient = dynamic(
  () => import("@/components/settings/sailing-routes/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type PageProps = {
  params: { locale: string };
};

const SailingRoutesPage = async ({ params }: PageProps) => {
  const { locale } = params;

  let data: SailingRouteColumn[] | null = null;
  const result = await getSailingRoutes();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as SailingRouteColumn[]) : null;
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <SailingRoutesClient
          data={data}
          path={`/${locale}/settings/sailing-routes/new`}
        />
      </div>
    </main>
  );
};

export default SailingRoutesPage;
