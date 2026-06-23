"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { PermissionsSuperAdminGate } from "@/components/permissions/permissions-super-admin-gate";

export function PermissionsRolesDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";

  useEffect(() => {
    router.replace(`/${locale}/permissions/roles`);
  }, [locale, router]);

  return (
    <PermissionsSuperAdminGate>
      <main className="flex min-h-screen w-full flex-col">
        <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
          جاري التحويل إلى قائمة الأدوار...
        </div>
      </main>
    </PermissionsSuperAdminGate>
  );
}
