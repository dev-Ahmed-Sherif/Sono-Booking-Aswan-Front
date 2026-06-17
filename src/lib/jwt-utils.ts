/** Decode JWT `exp` (ms since epoch). Does not verify signature — timing only. */
export function getJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(
      typeof atob !== "undefined"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8"),
    ) as { exp?: number };

    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** True when the token expires within `bufferMs` (default 10 minutes). */
export function shouldRefreshToken(
  token: string,
  bufferMs = 10 * 60 * 1000,
): boolean {
  const exp = getJwtExpiryMs(token);
  if (!exp) return false;
  return exp - Date.now() <= bufferMs;
}
