export const NAV_STORAGE_KEY = "Nav";

export type StoredNavRoute = {
  userId: string;
  path: string;
};

export function isLoginRootPath(path: string): boolean {
  const normalized = path.trim();
  return (
    normalized === "/ar" ||
    normalized === "/en" ||
    normalized === "/ar/" ||
    normalized === "/en/"
  );
}

export function isAppRoutePath(path: string): boolean {
  const normalized = path.trim();
  return normalized.startsWith("/ar/") || normalized.startsWith("/en/");
}

function parseStoredNav(raw: unknown): StoredNavRoute | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    // Legacy string-only value — ignore to avoid leaking routes across users.
    return null;
  }

  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const userId = String(record.userId ?? "").trim();
    const path = String(record.path ?? "").trim();
    if (!userId || !path || isLoginRootPath(path) || !isAppRoutePath(path)) {
      return null;
    }
    return { userId, path };
  }

  return null;
}

export function getStoredNavRoute(userId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return undefined;

  try {
    const item = localStorage.getItem(NAV_STORAGE_KEY);
    if (!item || item === "undefined" || item === "null") return undefined;
    const parsed = parseStoredNav(JSON.parse(item));
    if (!parsed || parsed.userId !== normalizedUserId) return undefined;
    return parsed.path;
  } catch {
    return undefined;
  }
}

export function setStoredNavRoute(userId: string, path: string): void {
  if (typeof window === "undefined") return;

  const normalizedUserId = userId.trim();
  const normalizedPath = path.trim();
  if (
    !normalizedUserId ||
    !normalizedPath ||
    isLoginRootPath(normalizedPath) ||
    !isAppRoutePath(normalizedPath)
  ) {
    return;
  }

  try {
    localStorage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({
        userId: normalizedUserId,
        path: normalizedPath,
      } satisfies StoredNavRoute),
    );
  } catch (error) {
    console.error("Error saving nav route:", error);
  }
}

export function clearStoredNavRoute(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NAV_STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing nav route:", error);
  }
}
