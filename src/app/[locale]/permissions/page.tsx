import { PermissionsPageClient } from "@/components/permissions/permissions-page-client";

type PermissionsPageProps = {
  params: {
    locale: string;
  };
};

async function PermissionsPage({ params }: PermissionsPageProps) {
  const { locale } = params;

  return <PermissionsPageClient locale={locale} />;
}

export default PermissionsPage;
