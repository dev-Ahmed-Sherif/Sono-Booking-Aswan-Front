import type { RoleCandidates } from "@/lib/role-utils";
import { buildRoleCandidatesFromUserRecord } from "@/lib/nav-routes";

/** Unwrap user DTO from auth API / server-action payloads. */
export function unwrapAuthUserDto(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const level1 = root.data;
  if (level1 && typeof level1 === "object") {
    const inner = level1 as Record<string, unknown>;
    if (inner.data && typeof inner.data === "object") {
      return inner.data as Record<string, unknown>;
    }
    if (
      inner.id != null ||
      inner.Id != null ||
      inner.role != null ||
      inner.Role != null
    ) {
      return inner;
    }
  }

  if (
    root.id != null ||
    root.Id != null ||
    root.role != null ||
    root.Role != null
  ) {
    return root;
  }

  return null;
}

export function buildStoredUserFromAuthDto(
  userData: Record<string, unknown>,
): Record<string, unknown> {
  const id = userData.id ?? userData.Id;
  const role = userData.role ?? userData.Role;
  const name = userData.name ?? userData.Name;
  const organizationId = userData.organizationId ?? userData.OrganizationId;
  const governorateId = userData.governorateId ?? userData.GovernorateId;
  const employeeId = userData.employeeId ?? userData.EmployeeId;

  return {
    id,
    role,
    name,
    organizationId: organizationId ?? "",
    governorateId: governorateId ?? "",
    roleName: userData.roleName ?? userData.RoleName,
    roleEn: userData.roleEn ?? userData.RoleEn,
    roleAr: userData.roleAr ?? userData.RoleAr,
    ...(employeeId != null && employeeId !== ""
      ? { employeeId }
      : {}),
  };
}

export function roleCandidatesFromAuthUser(
  userData: Record<string, unknown> | null | undefined,
): RoleCandidates {
  return buildRoleCandidatesFromUserRecord(userData);
}
