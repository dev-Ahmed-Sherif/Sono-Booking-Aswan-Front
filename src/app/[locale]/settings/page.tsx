import { NavigationCards } from "@/components/Shared/navigation-cards";

type SettingsProps = {
  params: {
    locale: string;
  };
};

const segment = "settings";
const segmentMeta: Record<string, { title: string; description: string }> = {
  settings: {
    title: "الإعدادات",
    description: "اختر القسم الذي تريد إدارته",
  },
};

const navigationItems = [
  {
    title: "فئات الشركات و الجهات",
    description: "إدارة فئات الشركات و الجهات",
    href: "/settings/organization-catagory",
    icon: "Building2",
    color: "from-indigo-500 to-indigo-600",
    hoverColor: "hover:from-indigo-600 hover:to-indigo-700",
  },
  {
    title: "أنواع الوحدات العائمة",
    description: "إدارة أنواع الوحدات العائمة",
    href: "/settings/floating-unit-types",
    icon: "Ship",
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    title: "خطوط السير للعائمات",
    description: "إدارة خطوط السير للعائمات",
    href: "/settings/sailing-routes",
    icon: "Route",
    color: "from-emerald-500 to-emerald-600",
    hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
  },
  {
    title: "أنواع الحوادث للعائمات",
    description: "إدارة أنواع الحوادث للعائمات",
    href: "/settings/accident-types",
    icon: "AlertTriangle",
    color: "from-red-500 to-red-600",
    hoverColor: "hover:from-red-600 hover:to-red-700",
  },
  {
    title: "أنواع الصيانات للعائمات",
    description: "إدارة أنواع الصيانات للعائمات",
    href: "/settings/maintenance-types",
    icon: "Wrench",
    color: "from-amber-500 to-amber-600",
    hoverColor: "hover:from-amber-600 hover:to-amber-700",
  },
  {
    title: "أنواع التفتيش للعائمات",
    description: "إدارة أنواع التفتيش للعائمات",
    href: "/settings/inspection-types",
    icon: "ClipboardCheck",
    color: "from-teal-500 to-teal-600",
    hoverColor: "hover:from-teal-600 hover:to-teal-700",
  },
  {
    title: "الجنسيات",
    description: "إدارة الجنسيات",
    href: "/settings/nationalities",
    icon: "Flag",
    color: "from-violet-500 to-violet-600",
    hoverColor: "hover:from-violet-600 hover:to-violet-700",
  },
];

async function Settings({ params }: SettingsProps) {
  const { locale } = params;

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {segmentMeta[segment]?.title ?? segment}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {segmentMeta[segment]?.description ?? ""}
        </p>
      </div>

      <NavigationCards items={navigationItems} locale={locale} />
    </main>
  );
}

export default Settings;
