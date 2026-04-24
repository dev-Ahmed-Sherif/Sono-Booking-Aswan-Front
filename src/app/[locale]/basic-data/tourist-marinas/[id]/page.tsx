import { getTouristMarinaById } from "@/actions/basic-data/touristMarinaService";
import { getTouristMarinaOrganizations } from "@/actions/basic-data/touristMarinaOrganizationService";
import TouristMarinasForm from "@/components/basic-data/tourist-marinas/tourist-marinas-form";
import type { TouristMarinaOrganizationColumn } from "@/components/basic-data/tourist-marina-organization/columns";

type PageProps = { params: { locale: string; id: string } };

const TouristMarinaIdPage = async ({ params }: PageProps) => {
  const { id } = params;
  let initialData: unknown = null;
  let touristMarinaOrganizationsData: TouristMarinaOrganizationColumn[] | null =
    null;
  if (id && id !== "new") {
    const result = await getTouristMarinaById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
    const organizationsResult = await getTouristMarinaOrganizations(id);
    if (
      organizationsResult &&
      !(organizationsResult as { error?: string }).error
    ) {
      const raw =
        (organizationsResult as { data?: unknown }).data ?? organizationsResult;
      touristMarinaOrganizationsData = Array.isArray(raw)
        ? (raw as TouristMarinaOrganizationColumn[])
        : null;
    }
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <TouristMarinasForm
            initialData={initialData}
            name="المرسى السياحي"
            touristMarinaOrganizationsData={touristMarinaOrganizationsData}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};
export default TouristMarinaIdPage;
