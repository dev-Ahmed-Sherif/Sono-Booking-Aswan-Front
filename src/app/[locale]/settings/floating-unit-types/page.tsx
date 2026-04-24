import dynamic from "next/dynamic";
import { getFloatingUnitTypes } from "@/actions/settings/floatingUnitTypeService";

const FloatingUnitTypesClient = dynamic(
  () => import("@/components/settings/floating-unit-types/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type PageProps = {
  params: { locale: string };
};

const FloatingUnitTypesPage = async ({ params }: PageProps) => {
  const { locale } = params;

  const result = await getFloatingUnitTypes();

  // Handle errors
  if (result?.error) {
    console.error("Error fetching technical jobs:", result.message);
    // Pass empty array on error, or you could show an error message
    return (
      <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
        <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <FloatingUnitTypesClient
            data={[]}
            path={`/${locale}/settings/floating-unit-types/new`}
          />
        </div>
      </main>
    );
  }

  const data = Array.isArray(result.data) ? result.data : [];

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <FloatingUnitTypesClient
          data={data}
          path={`/${locale}/settings/floating-unit-types/new`}
        />
      </div>
    </main>
  );
};

export default FloatingUnitTypesPage;
