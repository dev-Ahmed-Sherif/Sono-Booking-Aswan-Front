import {
  canAccessHousingReceiverFromCandidates,
  canAccessHousingSenderFromCandidates,
  HOUSING_SENDER_ROLE,
  isSuperAdminRoleCandidates,
  normalizeRole,
  type RoleCandidates,
} from "@/lib/role-utils";

export type NavRouteDef = {
  id: number;
  href: string;
};

/** Backend ASP.NET Identity role names (RoleNames.cs). */
export const BACKEND_ROLE = {
  USER: "User",
  LEADER: "Leader",
  RECEPTION_STAFF: "ReceptionStaff",
  ADMIN: "Admin",
  SUPER_ADMIN: "SuperAdmin",
} as const;

export function buildAllNavRoutes(locale: string): NavRouteDef[] {
  const base = `/${locale}`;
  return [
    { id: 1, href: `${base}/dashboard` },
    { id: 2, href: `${base}/reservation` },
    { id: 3, href: `${base}/housing-receiver` },
    { id: 4, href: `${base}/housing-sender` },
    { id: 5, href: `${base}/settings` },
    { id: 6, href: `${base}/reports` },
    { id: 7, href: `${base}/permissions` },
  ];
}

export function buildRoleCandidatesFromUserRecord(
  record: Record<string, unknown> | null | undefined,
): RoleCandidates {
  if (!record) return {};
  return {
    role: record.role ?? record.Role,
    roleName: record.roleName ?? record.RoleName,
    roleEn: record.roleEn ?? record.RoleEn,
    roleAr: record.roleAr ?? record.RoleAr,
  };
}

function roleValues(candidates: RoleCandidates): string[] {
  return [candidates.role, candidates.roleName, candidates.roleEn, candidates.roleAr]
    .map((value) => normalizeRole(value))
    .filter(Boolean);
}

export function matchesBackendRole(
  candidates: RoleCandidates,
  backendRole: string,
): boolean {
  const target = normalizeRole(backendRole);
  if (!target) return false;
  return roleValues(candidates).includes(target);
}

export function isRegularUserRole(candidates: RoleCandidates): boolean {
  return matchesBackendRole(candidates, BACKEND_ROLE.USER);
}

export function isLeaderRole(candidates: RoleCandidates): boolean {
  return (
    matchesBackendRole(candidates, BACKEND_ROLE.LEADER) ||
    canAccessHousingSenderFromCandidates(candidates)
  );
}

export function isReceptionStaffRole(candidates: RoleCandidates): boolean {
  return (
    matchesBackendRole(candidates, BACKEND_ROLE.RECEPTION_STAFF) ||
    canAccessHousingReceiverFromCandidates(candidates)
  );
}

/** Same visibility rules as the navbar tabs. */
export function getAllowedNavRoutes(
  locale: string,
  candidates: RoleCandidates,
): NavRouteDef[] {
  const allRoutes = buildAllNavRoutes(locale);

  const canAccessReports =
    isSuperAdminRoleCandidates(candidates) ||
    canAccessHousingSenderFromCandidates(candidates);

  const canAccessPermissions = isSuperAdminRoleCandidates(candidates);

  if (isRegularUserRole(candidates)) {
    return allRoutes.filter((route) => route.href === `/${locale}/reservation`);
  }

  if (isLeaderRole(candidates)) {
    return allRoutes.filter(
      (route) =>
        route.href === `/${locale}/dashboard` ||
        route.href === `/${locale}/housing-sender` ||
        route.href === `/${locale}/reports`,
    );
  }

  if (isReceptionStaffRole(candidates)) {
    return allRoutes.filter(
      (route) => route.href === `/${locale}/housing-receiver`,
    );
  }

  return allRoutes.filter((route) => {
    if (route.href === `/${locale}/housing-sender`) {
      return canAccessHousingSenderFromCandidates(candidates);
    }
    if (route.href === `/${locale}/housing-receiver`) {
      return canAccessHousingReceiverFromCandidates(candidates);
    }
    if (route.href === `/${locale}/reports`) {
      return canAccessReports;
    }
    if (route.href === `/${locale}/permissions`) {
      return canAccessPermissions;
    }
    return true;
  });
}

export function getFirstAllowedNavRoute(
  locale: string,
  candidates: RoleCandidates,
): string {
  const routes = getAllowedNavRoutes(locale, candidates);
  return routes[0]?.href ?? `/${locale}/reservation`;
}

export function isAllowedNavRoute(
  locale: string,
  candidates: RoleCandidates,
  path: string,
): boolean {
  const normalizedPath = path.trim();
  if (!normalizedPath) return false;

  return getAllowedNavRoutes(locale, candidates).some(
    (route) =>
      normalizedPath === route.href ||
      normalizedPath.startsWith(`${route.href}/`),
  );
}

function toRoleCandidates(
  roleOrCandidates: unknown | RoleCandidates,
): RoleCandidates {
  if (
    roleOrCandidates &&
    typeof roleOrCandidates === "object" &&
    ("role" in roleOrCandidates ||
      "roleName" in roleOrCandidates ||
      "roleEn" in roleOrCandidates ||
      "roleAr" in roleOrCandidates)
  ) {
    return roleOrCandidates as RoleCandidates;
  }
  return { role: roleOrCandidates };
}

/** First navbar tab the user is allowed to access (post-login / unauthorized redirect). */
export function getPostLoginPath(
  locale: string,
  roleOrCandidates: unknown | RoleCandidates,
): string {
  return getFirstAllowedNavRoute(locale, toRoleCandidates(roleOrCandidates));
}
