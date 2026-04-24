export type IsDeletedFilter = "active" | "deleted" | "all";

function isRowMarkedDeleted(row: unknown): boolean {
  if (row == null || typeof row !== "object") return false;
  const o = row as Record<string, unknown>;
  return o.isDeleted === true || o.IsDeleted === true;
}

export function filterByIsDeleted<T>(rows: T[], filter: IsDeletedFilter): T[] {
  if (filter === "all") return rows;
  if (filter === "deleted") return rows.filter((r) => isRowMarkedDeleted(r));
  return rows.filter((r) => !isRowMarkedDeleted(r));
}
