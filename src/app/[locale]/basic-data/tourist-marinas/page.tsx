import dynamic from "next/dynamic";
import { getTouristMarinas } from "@/actions/basic-data/touristMarinaService";
import type { TouristMarinaColumn } from "@/components/basic-data/tourist-marinas/columns";

const TouristMarinasClient = dynamic(() => import("@/components/basic-data/tourist-marinas/client"), { loading: () => <div className="p-4">جاري التحميل...</div> });

type PageProps = { params: { locale: string } };

const TouristMarinasPage = async ({ params }: PageProps) => {
  const { locale } = params;
  let data: TouristMarinaColumn[] | null = null;
  const result = await getTouristMarinas();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as TouristMarinaColumn[]) : null;
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <div className="flex-1 space-y-4 pt-6">
          <TouristMarinasClient data={data} path={`/${locale}/basic-data/tourist-marinas/new`} />
        </div>
      </div>
    </main>
  );
};
export default TouristMarinasPage;
