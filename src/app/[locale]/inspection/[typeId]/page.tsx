import dynamic from "next/dynamic";

import { getInspections } from "@/actions/inspection/inspectionService";
import { getInspectionTypeById } from "@/actions/settings/inspectionTypeService";
import type { InspectionColumn } from "@/components/inspections/inspection/columns";

const InspectionClient = dynamic(
  () => import("@/components/inspections/inspection/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type PageProps = {
  params: { locale: string; typeId: string };
};

const InspectionCategoryPage = async ({ params }: PageProps) => {
  const { locale, typeId } = params;

  let data: InspectionColumn[] | null = null;
  let showEnvironmentalColumns = false;
  const result = await getInspections(typeId);
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as InspectionColumn[]) : null;
  }

  const typeResult = await getInspectionTypeById(typeId);
  if (typeResult && !(typeResult as { error?: string }).error) {
    const raw = (typeResult as { data?: unknown }).data ?? typeResult;
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const name = String(obj.nameAr ?? obj.NameAr ?? obj.name ?? obj.Name ?? "")
        .trim()
        .replaceAll("أ", "ا")
        .replaceAll("إ", "ا")
        .replaceAll("آ", "ا");
      showEnvironmentalColumns = name === "تفتيش بيئي" || name === "تفتيش بيئى";
    }
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <InspectionClient
          data={data}
          path={`/${locale}/inspection/${typeId}/new`}
          backPath={`/${locale}/inspection`}
          editPathPrefix={`/inspection/${typeId}`}
          showEnvironmentalColumns={showEnvironmentalColumns}
        />
      </div>
    </main>
  );
};

export default InspectionCategoryPage;
