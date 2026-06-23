/** Resolves API base URL from env (same pattern as userService). */
export function getApiBaseUrl(): string {
  return process.env.BACK_END ?? process.env.BACK_END_DEV ?? "";
}

/** Unwraps list payloads whether the API returns an array or `{ data: [...] }`. */
export function unwrapApiList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];

  if (typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as T[];

  if (obj.data && typeof obj.data === "object") {
    const inner = obj.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as T[];
  }

  return [];
}

export function errorMessageFromAxios(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
