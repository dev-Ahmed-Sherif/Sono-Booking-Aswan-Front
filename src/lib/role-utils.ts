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

