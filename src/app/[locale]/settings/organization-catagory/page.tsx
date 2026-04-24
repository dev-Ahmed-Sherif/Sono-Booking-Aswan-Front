import dynamic from "next/dynamic";

import { getOrganizationCategories } from "@/actions/settings/organizationCategoryService";
import type { OrganizationCatagoryColumn } from "@/components/settings/organization-catagory/columns";

const OrganizationCatagoryClient = dynamic(
  () => import("@/components/settings/organization-catagory/client"),
  { loading: () => <div className="p-4">جاري التحميل...</div> }
);

type OrganizationCatagoryPageProps = {
  params: { locale: string };
};

const OrganizationCatagoryPage = async ({
  params,
}: OrganizationCatagoryPageProps) => {
  const { locale } = params;

  let data: OrganizationCatagoryColumn[] | null = null;
  const result = await getOrganizationCategories();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    data = Array.isArray(raw) ? (raw as OrganizationCatagoryColumn[]) : null;
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 w-full border border-solid sm:border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-900">
        <OrganizationCatagoryClient
          data={data}
          path={`/${locale}/settings/organization-catagory/new`}
        />
      </div>
    </main>
  );
};

export default OrganizationCatagoryPage;
