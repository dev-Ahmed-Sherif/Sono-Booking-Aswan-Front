import { getInspectionTypeById } from "@/actions/settings/inspectionTypeService";
import InspectionTypesForm from "@/components/settings/inspection-types/inspection-types-form";

type PageProps = {
  params: { locale: string; id: string };
};

const InspectionTypePage = async ({ params }: PageProps) => {
  const { id } = params;
  let initialData: unknown = null;
  if (id && id !== "new") {
    const result = await getInspectionTypeById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <InspectionTypesForm initialData={initialData} name="نوع الفحص" />
        </div>
      </div>
    </main>
  );
};

export default InspectionTypePage;
