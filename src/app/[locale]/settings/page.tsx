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
    title: "أنواع الشقق",
    description: "إدارة أنواع الشقق",
    href: "/settings/apartment-types",
    icon: "Building",
    color: "from-indigo-500 to-indigo-600",
    hoverColor: "hover:from-indigo-600 hover:to-indigo-700",
  },
  {
    title: "أنواع الغرف",
    description: "إدارة أنواع الغرف",
    href: "/settings/room-types",
    icon: "BedDouble",
    color: "from-red-500 to-red-600",
    hoverColor: "hover:from-red-600 hover:to-red-700",
  },
  {
    title: "أيام الحجز المسبق",
    description: "إدارة عدد الأيام المسموح بها قبل تاريخ الحجز",
    href: "/settings/allowed-day-before-reservations",
    icon: "ClipboardCheck",
    color: "from-amber-500 to-amber-600",
    hoverColor: "hover:from-amber-600 hover:to-amber-700",
  },
  {
    title: "بيانات الوحدات",
    description: "إدارة بيانات الوحدات",
    href: "/settings/unit-data",
    icon: "Building2",
    color: "from-sky-500 to-sky-600",
    hoverColor: "hover:from-sky-600 hover:to-sky-700",
  },
  {
    title: "المحافظات",
    description: "إدارة المحافظات",
    href: "/settings/governorates",
    icon: "Building2",
    color: "from-indigo-500 to-indigo-600",
    hoverColor: "hover:from-indigo-600 hover:to-indigo-700",
  },
  {
    title: "العلاقات الأسرية",
    description: "إدارة العلاقات الأسرية",
    href: "/settings/relationships",
    icon: "Users",
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    title: "أنواع الطلبات",
    description: "إدارة أنواع الطلبات",
    href: "/settings/request-types",
    icon: "FileText",
    color: "from-emerald-500 to-emerald-600",
    hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
  },
  {
    title: "أنواع التخصيص",
    description: "إدارة أنواع التخصيص",
    href: "/settings/allocation-types",
    icon: "Layers",
    color: "from-violet-500 to-violet-600",
    hoverColor: "hover:from-violet-600 hover:to-violet-700",
  },
  {
    title: "طرق الدفع",
    description: "إدارة طرق الدفع",
    href: "/settings/payment-methods",
    icon: "Wallet",
    color: "from-cyan-500 to-cyan-600",
    hoverColor: "hover:from-cyan-600 hover:to-cyan-700",
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

      <NavigationCards items={navigationItems} locale={locale} columns={3} />
    </main>
  );
}

export default Settings;
