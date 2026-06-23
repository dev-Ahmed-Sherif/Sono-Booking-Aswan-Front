export const SONOBOOKING_STAFF_EMAIL_SUFFIX = "@sonobooking.com";

export function isSonoBookingStaffEmail(email: unknown): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.endsWith(SONOBOOKING_STAFF_EMAIL_SUFFIX);
}

export function filterSonoBookingStaffUsers<T extends { email?: unknown }>(
  users: T[] | null | undefined,
): T[] {
  if (!users?.length) return [];
  return users.filter((user) => isSonoBookingStaffEmail(user.email));
}
