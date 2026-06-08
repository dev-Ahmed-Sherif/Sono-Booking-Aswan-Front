import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getGovernorates } from "@/actions/settings/governorateService";
import type { GovernorateColumn } from "@/components/settings/governorates/columns";

const GovernorateClient = dynamic(
  () => import("@/components/settings/governorates/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> },
);

type PageProps = { params: { locale: string } };

const GovernoratePage = async ({ params }: PageProps) => {
  const { locale } = params;
  let data: GovernorateColumn[] | null = null;
  const result = await getGovernorates();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as GovernorateColumn[]) : null;
  }
  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <Link
          href={`/${params.locale}/settings`}
          className="mb-2 inline-flex items-center gap-2 rounded-md px-4 h-10 text-base hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowRight className="h-5 w-5" />
          رجوع
        </Link>
        <div className="flex-1 space-y-4 pt-6">
          <GovernorateClient
            data={data}
            path={`/${locale}/settings/governorates/new`}
          />
        </div>
      </div>
      <div className="my-14 text-transparent">t</div>
    </main>
  );
};
export default GovernoratePage;
