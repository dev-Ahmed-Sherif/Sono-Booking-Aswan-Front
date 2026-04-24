import { NavigationCards } from "@/components/Shared/navigation-cards";

type PermissionsPageProps = {
  params: {
    locale: string;
  };
};

const navigationItems = [
  {
    title: "المستخدمين",
    description: "إدارة المستخدمين والصلاحيات",
    href: "/permissions/users",
    icon: "Users",
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    title: "الأدوار",
    description: "إدارة الأدوار والصلاحيات",
    href: "/permissions/roles",
    icon: "ShieldCheck",
    color: "from-green-500 to-green-600",
    hoverColor: "hover:from-green-600 hover:to-green-700",
  },
  {
    title: "الموديلات",
    description: "موديلات النظام",
    href: "/permissions/modules",
    icon: "Blocks",
    color: "from-violet-500 to-violet-600",
    hoverColor: "hover:from-violet-600 hover:to-violet-700",
  },
  {
    title: "الصفحات",
    description: "صفحات النظام",
    href: "/permissions/pages",
    icon: "Pages",
    color: "from-amber-500 to-amber-600",
    hoverColor: "hover:from-amber-600 hover:to-amber-700",
  },
];

async function PermissionsPage({ params }: PermissionsPageProps) {
  const { locale } = params;

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen pb-24 sm:pb-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          الصلاحيات
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          اختر القسم لإدارة الصلاحيات
        </p>
      </div>

      <NavigationCards items={navigationItems} locale={locale} />
    </main>
  );
}

export default PermissionsPage;
