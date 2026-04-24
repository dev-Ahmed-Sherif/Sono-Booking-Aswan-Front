import dynamic from "next/dynamic";

import { getCities } from "@/actions/basic-data/cityService";
import { normalizeAllCitiesResponse } from "@/lib/governorate-cities";
import type { CityColumn } from "@/components/basic-data/city/columns";

const CityClient = dynamic(
  () => import("@/components/basic-data/city/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type CityPageProps = {
  params: { locale: string };
};

const CityPage = async ({ params }: CityPageProps) => {
  const { locale } = params;

  let data: CityColumn[] | null = null;
  const result = await getCities();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = normalizeAllCitiesResponse(raw);
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <CityClient
          data={data}
          path={`/${locale}/basic-data/city/new`}
        />
      </div>
    </main>
  );
};

export default CityPage;
