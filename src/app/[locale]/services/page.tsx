import { NavigationCards } from "@/components/Shared/navigation-cards";

type ServicesPageProps = {
  params: {
    locale: string;
  };
};

const navigationItems = [
  {
    title: "تراخيص المراسى السياحية",
    description: "طلبات الترخيص وإدارة بيانات المراسى السياحية",
    href: "/services/license-tourist-marina",
    icon: "Anchor",
    color: "from-cyan-500 to-cyan-600",
    hoverColor: "hover:from-cyan-600 hover:to-cyan-700",
  },
];

async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = params;

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen pb-24 sm:pb-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          الخدمات
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          اختر الخدمة
        </p>
      </div>

      <NavigationCards items={navigationItems} locale={locale} />
    </main>
  );
}

export default ServicesPage;
