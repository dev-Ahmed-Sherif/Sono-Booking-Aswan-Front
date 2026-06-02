/**
 * Next.js server actions must return values that serialize to the client
 * (plain objects, arrays, primitives). Axios `data` can violate that rule.
 */
export function toPlainSerializable<T>(value: T): T {
  if (value === undefined || value === null) {
    return null as T;
  }
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ) as T;
  } catch {
    return null as T;
  }
}
