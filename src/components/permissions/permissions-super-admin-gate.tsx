"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useEffectiveRole } from "@/hooks/use-effective-role";
import { useRequireRole } from "@/hooks/use-require-role";
import { isSuperAdminRoleCandidates } from "@/lib/role-utils";

type PermissionsSuperAdminGateProps = {
  children: ReactNode;
};

export function PermissionsSuperAdminGate({
  children,
}: PermissionsSuperAdminGateProps) {
  const { roleCandidates, isRoleReady } = useEffectiveRole();
  const allowed = isSuperAdminRoleCandidates(roleCandidates);
  const { allowed: canView } = useRequireRole({ allowed });

  if (!isRoleReady || !canView) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>جاري التحقق من الصلاحيات...</span>
      </div>
    );
  }

  return <>{children}</>;
}
