"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { useEffectiveRole } from "@/hooks/use-effective-role";
import { getPostLoginPath } from "@/lib/role-utils";

type UseRequireRoleOptions = {
  /** When true, redirects unauthorized users away from the page. */
  allowed: boolean;
};

/**
 * Redirects to a safe route when the user is known and not allowed.
 * Waits until role is resolved from Redux / localStorage before redirecting.
 */
export function useRequireRole({ allowed }: UseRequireRoleOptions) {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const { effectiveRole, isRoleReady } = useEffectiveRole();

  useEffect(() => {
    if (!isRoleReady || allowed) return;

    router.replace(getPostLoginPath(locale, effectiveRole));
  }, [allowed, effectiveRole, isRoleReady, locale, router]);

  return { effectiveRole, isRoleReady, allowed: !isRoleReady || allowed };
}
