import { getCityById } from "@/actions/basic-data/cityService";
import CityForm from "@/components/basic-data/city/city-form";

type PageProps = {
  params: { locale: string; id: string };
  searchParams?: { governorateId?: string };
};

const CityDetailPage = async ({ params, searchParams }: PageProps) => {
  const { id } = params;
  const governorateIdFromQuery =
    typeof searchParams?.governorateId === "string"
      ? searchParams.governorateId
      : undefined;

  let initialData: unknown = null;
  if (id && id !== "new") {
    const result = await getCityById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <CityForm
            initialData={initialData}
            name="مدينة"
            governorateId={governorateIdFromQuery}
          />
        </div>
      </div>
    </main>
  );
};

export default CityDetailPage;
