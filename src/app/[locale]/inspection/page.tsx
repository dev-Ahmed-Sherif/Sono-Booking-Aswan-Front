import { getInspectionTypes } from "@/actions/settings/inspectionTypeService";
import { NavigationCards } from "@/components/Shared/navigation-cards";

type InspectionPageProps = {
  params: { locale: string };
};

const segment = "inspection";
const segmentMeta: Record<string, { title: string; description: string }> = {
  inspection: {
    title: "التفتيش",
    description: "اختر نوع التفتيش",
  },
};

const CARD_STYLES = [
  {
    icon: "Leaf",
    color: "from-emerald-500 to-emerald-600",
    hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
  },
  {
    icon: "ShieldCheck",
    color: "from-amber-500 to-amber-600",
    hoverColor: "hover:from-amber-600 hover:to-amber-700",
  },
  {
    icon: "ClipboardCheck",
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    icon: "ScanLine",
    color: "from-violet-500 to-violet-600",
    hoverColor: "hover:from-violet-600 hover:to-violet-700",
  },
] as const;

const InspectionPage = async ({ params }: InspectionPageProps) => {
  const { locale } = params;

  let navigationItems: {
    title: string;
    description: string;
    href: string;
    icon: string;
    color: string;
    hoverColor: string;
  }[] = [];

  const result = await getInspectionTypes();
  if (result && !(result as { error?: string }).error) {
    const raw = (result as { data?: unknown }).data ?? result;
    const types = Array.isArray(raw) ? raw : [];
    const list = types as { id: string; nameAr?: string; nameEn?: string }[];
    navigationItems = list.map((type, index) => {
      const style = CARD_STYLES[index % CARD_STYLES.length];
      const title = type.nameAr ?? type.nameEn ?? type.id;
      return {
        title,
        description: `إدارة التفتيش - ${title}`,
        href: `/inspection/${type.id}`,
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
          {segmentMeta[segment]?.title ?? "التفتيش"}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {segmentMeta[segment]?.description ?? ""}
        </p>
      </div>

      {navigationItems.length > 0 ? (
        <NavigationCards items={navigationItems} locale={locale} />
      ) : (
        <p className="text-muted-foreground">
          لا توجد أنواع تفتيش. أضف الأنواع من الإعدادات أولاً.
        </p>
      )}
    </main>
  );
};

export default InspectionPage;
