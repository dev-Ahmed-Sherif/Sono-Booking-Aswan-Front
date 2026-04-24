import { getTranslations, setRequestLocale } from "next-intl/server";

import { NavigationCards } from "@/components/Shared/navigation-cards";

type BasicDataPageProps = {
  params: {
    locale: string;
  };
};

async function BasicDataPage({ params }: BasicDataPageProps) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "BasicData" });

  const navigationItems = [
    {
      title: t("governorate.title"),
      description: t("governorate.description"),
      href: "/basic-data/governorate",
      icon: "MapPin",
      color: "from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
    },
    {
      title: t("partiesOfficials.title"),
      description: t("partiesOfficials.description"),
      href: "/basic-data/parties-officials",
      icon: "Landmark",
      color: "from-violet-500 to-violet-600",
      hoverColor: "hover:from-violet-600 hover:to-violet-700",
    },
    {
      title: t("owningCompanies.title"),
      description: t("owningCompanies.description"),
      href: "/basic-data/owning-companies",
      icon: "Building2",
      color: "from-emerald-500 to-emerald-600",
      hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
    },
    {
      title: t("operatingCompanies.title"),
      description: t("operatingCompanies.description"),
      href: "/basic-data/operating-companies",
      icon: "Briefcase",
      color: "from-amber-500 to-amber-600",
      hoverColor: "hover:from-amber-600 hover:to-amber-700",
    },
    {
      title: t("touristMarinas.title"),
      description: t("touristMarinas.description"),
      href: "/basic-data/tourist-marinas",
      icon: "Anchor",
      color: "from-cyan-500 to-cyan-600",
      hoverColor: "hover:from-cyan-600 hover:to-cyan-700",
    },
    {
      title: t("floatingUnit.title"),
      description: t("floatingUnit.description"),
      href: "/basic-data/floating-unit",
      icon: "Ship",
      color: "from-slate-500 to-slate-600",
      hoverColor: "hover:from-slate-600 hover:to-slate-700",
    },
    {
      title: "بنود التفتيش",
      description: "إدارة بنود التفتيش",
      href: "/basic-data/inspection-clause",
      icon: "ClipboardList",
      color: "from-rose-500 to-rose-600",
      hoverColor: "hover:from-rose-600 hover:to-rose-700",
    },
  ];

  return (
    <main className="container mx-auto mt-2 sm:mt-4 px-2 sm:px-4 md:px-6 lg:px-8 min-h-screen sm:pb-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {t("page.title")}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {t("page.description")}
        </p>
      </div>

      <NavigationCards items={navigationItems} locale={locale} />
    </main>
  );
}

export default BasicDataPage;
