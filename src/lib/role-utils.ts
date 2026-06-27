
export type RoleCandidates = {
  role?: unknown;
  roleName?: unknown;
  roleEn?: unknown;
  roleAr?: unknown;
};

const isSuperAdminNormalized = (value: unknown) => {
  if (value === undefined || value === null) return false;
  const r = String(value).toLowerCase().trim();
  if (!r) return false;

  return (
    r === "super admin" ||
    r === "superadmin" ||
    r.includes("super admin") ||
    r.includes("superadmin")
  );
};

export const isSuperAdminRoleCandidates = (candidates?: RoleCandidates) => {
  if (!candidates) return false;

  const roleCandidates = [
    candidates.role,
    candidates.roleName,
    candidates.roleEn,
    candidates.roleAr,
  ];

  return roleCandidates.some(isSuperAdminNormalized);
};

/**
 * Case-insensitive role slug: trimmed, lowercased, spaces/underscores/hyphens removed.
 * e.g. `Leader`, `LEADER`, `ReceptionStaff`, `RECEPTION_STAFF` → comparable slugs.
 */
export const normalizeRole = (role: unknown) =>
  String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/** Housing sender dashboard (`/housing-sender`) — Aswan leader role. */
export const HOUSING_SENDER_ROLE = "leader";

/** Housing receiver dashboard (`/housing-receiver`) — Cairo reception staff role. */
export const HOUSING_RECEIVER_ROLE = "receptionstaff";

/** Accepted sender role strings (any casing / spacing). */
const HOUSING_SENDER_ALIASES = [
  "leader",
  "Leader",
  "LEADER",
] as const;

/** Accepted receiver role strings (any casing / spacing). */
const HOUSING_RECEIVER_ALIASES = [
  "receptionstaff",
  "ReceptionStaff",
  "RECEPTIONSTAFF",
  "reception staff",
  "Reception Staff",
  "RECEPTION_STAFF",
] as const;

const matchesAnyRoleAlias = (
  role: unknown,
  aliases: readonly string[],
) => {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return aliases.some((alias) => normalizeRole(alias) === normalized);
};

export const canAccessHousingSender = (role: unknown) =>
  matchesAnyRoleAlias(role, HOUSING_SENDER_ALIASES);

export const canAccessHousingReceiver = (role: unknown) =>
  matchesAnyRoleAlias(role, HOUSING_RECEIVER_ALIASES);

/** Check role from any common user payload fields (case-insensitive). */
export const canAccessHousingSenderFromCandidates = (
  candidates?: RoleCandidates,
) => {
  if (!candidates) return false;
  return [
    candidates.role,
    candidates.roleName,
    candidates.roleEn,
    candidates.roleAr,
  ].some(canAccessHousingSender);
};

export const canAccessHousingReceiverFromCandidates = (
  candidates?: RoleCandidates,
) => {
  if (!candidates) return false;
  return [
    candidates.role,
    candidates.roleName,
    candidates.roleEn,
    candidates.roleAr,
  ].some(canAccessHousingReceiver);
};

/** Reservation request owner (`/reservation`) — end-user role slug. */
export const END_USER_ROLE = "user";

export const isEndUserRole = (role: unknown) =>
  normalizeRole(role) === END_USER_ROLE;

/** Leader or reception staff — chat targets visible to end users. */
export const isChatStaffRole = (role: unknown) =>
  canAccessHousingSender(role) || canAccessHousingReceiver(role);


/** Account page: hide basic profile + companions for staff / admin roles. */
export const isAccountProfileAndCompanionsHidden = (
  candidates?: RoleCandidates,
) => {
  if (!candidates) return false;
  return (
    isSuperAdminRoleCandidates(candidates) ||
    canAccessHousingSenderFromCandidates(candidates) ||
    canAccessHousingReceiverFromCandidates(candidates)
  );
};
