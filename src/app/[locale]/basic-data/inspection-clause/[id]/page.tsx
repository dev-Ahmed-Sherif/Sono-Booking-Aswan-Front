import {
  getInspectionClauseById,
  getInspectionClauses,
} from "@/actions/inspection/inspectionClauseService";
import { getInspectionTypes } from "@/actions/settings/inspectionTypeService";
import InspectionClauseForm from "@/components/inspections/inspection-clause/inspection-clause-form";

type PageProps = {
  params: { locale: string; id: string };
};

const InspectionClauseDetailPage = async ({ params }: PageProps) => {
  const { id } = params;

  let initialData: unknown = null;
  if (id && id !== "new") {
    const result = await getInspectionClauseById(id);
    if (result && !(result as { error?: string }).error) {
      initialData = (result as { data?: unknown }).data ?? result;
    }
  }

  const inspectionTypes: { id: string; nameAr?: string }[] = [];
  const typesResult = await getInspectionTypes();
  if (typesResult && !(typesResult as { error?: string }).error) {
    const raw = (typesResult as { data?: unknown }).data ?? typesResult;
    if (Array.isArray(raw)) {
      inspectionTypes.push(...(raw as { id: string; nameAr?: string }[]));
    }
  }

  const parentClauses: { id: string; code?: string; name?: string }[] = [];
  const clausesResult = await getInspectionClauses();
  if (clausesResult && !(clausesResult as { error?: string }).error) {
    const raw = (clausesResult as { data?: unknown }).data ?? clausesResult;
    if (Array.isArray(raw)) {
      const all = raw as { id: string; code?: string; name?: string }[];
      // parentClauses.push(...all.filter((c) => c.id !== id));
      parentClauses.push(...all);
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <InspectionClauseForm
            initialData={initialData}
            inspectionTypes={inspectionTypes}
            parentClauses={parentClauses}
            basePath="/basic-data/inspection-clause"
          />
        </div>
      </div>
    </main>
  );
};

export default InspectionClauseDetailPage;
