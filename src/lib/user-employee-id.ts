/** True when stored/API user payload includes a non-empty employee id. */
export function userHasEmployeeId(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const u = raw as Record<string, unknown>;
  const id = u.employeeId ?? u.EmployeeId;
  if (id == null || id === "") return false;
  if (typeof id === "number") return Number.isFinite(id) && id > 0;
  return String(id).trim().length > 0;
}
