import dynamic from "next/dynamic";

import { getAccidentTypes } from "@/actions/settings/accidentTypeService";
import type { AccidentTypeColumn } from "@/components/settings/accident-types/columns";

const AccidentTypesClient = dynamic(
  () => import("@/components/settings/accident-types/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type AccidentTypesPageProps = {
  params: { locale: string };
};

const AccidentTypesPage = async ({ params }: AccidentTypesPageProps) => {
  const { locale } = params;

  let data: AccidentTypeColumn[] | null = null;
  const result = await getAccidentTypes();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as AccidentTypeColumn[]) : null;
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <AccidentTypesClient
          data={data}
          path={`/${locale}/settings/accident-types/new`}
        />
      </div>
    </main>
  );
};

export default AccidentTypesPage;
