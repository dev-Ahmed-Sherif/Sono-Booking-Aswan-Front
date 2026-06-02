"use client";

import * as React from "react";
import { useSelector } from "react-redux";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { normalizeRole, type RoleCandidates } from "@/lib/role-utils";

/** Avoids SSR + first client paint reading `localStorage` (hydration mismatch). */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type StoredUserBrief = RoleCandidates & { name?: string; id?: string };

/**
 * Effective role from Redux, falling back to localStorage after mount.
 * Returns `null` while the storage snapshot is still pending.
 */
export function useEffectiveRole() {
  const { role } = useSelector((state: { user?: { role?: string } }) => state.user ?? {});
  const user = useLocalStorage("user");
  const [storedUserBrief, setStoredUserBrief] = React.useState<
    StoredUserBrief | null | "pending"
  >("pending");

  useIsomorphicLayoutEffect(() => {
    const raw = user.getItem() as StoredUserBrief | undefined;
    setStoredUserBrief(raw ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveRole = React.useMemo(() => {
    const fromRedux = String(role ?? "").trim();
    if (storedUserBrief === "pending") {
      return fromRedux ? normalizeRole(fromRedux) : null;
    }
    const fromStorage = storedUserBrief
      ? String(storedUserBrief.role ?? "").trim()
      : "";
    const resolved = fromRedux || fromStorage;
    return resolved ? normalizeRole(resolved) : "";
  }, [role, storedUserBrief]);

  const roleCandidates = React.useMemo((): RoleCandidates => {
    const fromRedux = String(role ?? "").trim();
    const stored =
      storedUserBrief !== "pending" && storedUserBrief ? storedUserBrief : null;
    const fromStorage = stored ? String(stored.role ?? "").trim() : "";
    const resolvedRole = fromRedux || fromStorage;

    return {
      role: resolvedRole || undefined,
      roleName: stored?.roleName,
      roleEn: stored?.roleEn,
      roleAr: stored?.roleAr,
    };
  }, [role, storedUserBrief]);

  const isRoleReady = storedUserBrief !== "pending";

  return { effectiveRole, roleCandidates, isRoleReady };
}
