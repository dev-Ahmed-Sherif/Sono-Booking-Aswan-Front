import { getOrganizationCategories } from "@/actions/settings/organizationCategoryService";
import { NavigationCards } from "@/components/Shared/navigation-cards";

const segment = "owning-companies";
const segmentMeta: Record<string, { title: string; description: string }> = {
  "owning-companies": {
    title: "الشركات المالكة",
    description: "اختر فئة الجهة لعرض أو إدارة الشركات المالكة",
  },
};

const CARD_STYLES = [
  { icon: "Building2", color: "from-emerald-500 to-emerald-600", hoverColor: "hover:from-emerald-600 hover:to-emerald-700" },
  { icon: "Landmark", color: "from-violet-500 to-violet-600", hoverColor: "hover:from-violet-600 hover:to-violet-700" },
  { icon: "Briefcase", color: "from-amber-500 to-amber-600", hoverColor: "hover:from-amber-600 hover:to-amber-700" },
  { icon: "Blocks", color: "from-blue-500 to-blue-600", hoverColor: "hover:from-blue-600 hover:to-blue-700" },
  { icon: "Database", color: "from-cyan-500 to-cyan-600", hoverColor: "hover:from-cyan-600 hover:to-cyan-700" },
  { icon: "Flag", color: "from-slate-500 to-slate-600", hoverColor: "hover:from-slate-600 hover:to-slate-700" },
] as const;

type OwningCompaniesPageProps = {
  params: { locale: string };
};

const OwningCompaniesPage = async ({ params }: OwningCompaniesPageProps) => {
  const { locale } = params;

  let navigationItems: { title: string; description: string; href: string; icon: string; color: string; hoverColor: string }[] = [];
  const result = await getOrganizationCategories();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    const categories = Array.isArray(raw) ? raw : [];
    const list = categories as { id: string; nameAr?: string; nameEn?: string }[];
    navigationItems = list.map((cat, index) => {
      const style = CARD_STYLES[index % CARD_STYLES.length];
      const title = cat.nameAr ?? cat.nameEn ?? cat.id;
      return {
        title,
        description: `إدارة الشركات المالكة - ${title}`,
        href: `/basic-data/owning-companies/${cat.id}`,
        icon: style.icon,
        color: style.color,
        hoverColor: style.hoverColor,
      };
    });
  }

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen sm:pb-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {segmentMeta[segment]?.title ?? "الشركات المالكة"}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {segmentMeta[segment]?.description ?? ""}
        </p>
      </div>

      {navigationItems.length > 0 ? (
        <NavigationCards items={navigationItems} locale={locale} />
      ) : (
        <p className="text-muted-foreground">لا توجد فئات جهات. أضف فئات من الإعدادات أولاً.</p>
      )}
    </main>
  );
};

export default OwningCompaniesPage;
