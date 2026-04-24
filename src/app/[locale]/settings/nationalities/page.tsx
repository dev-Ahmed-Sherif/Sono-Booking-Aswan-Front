import dynamic from "next/dynamic";

import { getNationalities } from "@/actions/settings/nationalityService";
import type { NationalityColumn } from "@/components/settings/nationalities/columns";

const NationalitiesClient = dynamic(
  () => import("@/components/settings/nationalities/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type PageProps = {
  params: { locale: string };
};

const NationalitiesPage = async ({ params }: PageProps) => {
  const { locale } = params;

  let data: NationalityColumn[] | null = null;
  const result = await getNationalities();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as NationalityColumn[]) : null;
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <NationalitiesClient
          data={data}
          path={`/${locale}/settings/nationalities/new`}
        />
      </div>
    </main>
  );
};

export default NationalitiesPage;
