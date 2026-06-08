import AllocationTypeForm from "@/components/settings/allocation-types/allocation-types-form";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SettingsLookupInitialData } from "@/lib/settings-lookup-initial-data";

type PageProps = { params: { locale: string; id: string } };

const AllocationTypePage = async ({ params }: PageProps) => {
  const { id } = params;
  let initialData: SettingsLookupInitialData = null;
  if (id && id !== "new") {
    initialData = null;
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
          <AllocationTypeForm initialData={initialData} name="نوع التخصيص" />
        </div>
      </div>
    </main>
  );
};

export default AllocationTypePage;
