import { NavigationCards } from "@/components/Shared/navigation-cards";

type OperationPageProps = {
  params: {
    locale: string;
  };
};

const navigationItems = [
  {
    title: "الحوادث",
    description: "إدارة الحوادث والإبلاغ عنها",
    href: "/operation/accidents",
    icon: "AlertTriangle",
    color: "from-red-500 to-red-600",
    hoverColor: "hover:from-red-600 hover:to-red-700",
  },
  {
    title: "الصيانات",
    description: "إدارة أعمال الصيانة والدورات",
    href: "/operation/maintenance",
    icon: "Wrench",
    color: "from-slate-500 to-slate-600",
    hoverColor: "hover:from-slate-600 hover:to-slate-700",
  },
];

async function OperationPage({ params }: OperationPageProps) {
  const { locale } = params;

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          التشغيل
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          اختر القسم
        </p>
      </div>

      <NavigationCards items={navigationItems} locale={locale} />
    </main>
  );
}

export default OperationPage;
