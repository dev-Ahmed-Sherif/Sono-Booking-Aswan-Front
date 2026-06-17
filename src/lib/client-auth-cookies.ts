import { refreshTokenCookieName } from "@/lib/auth-cookies";

/** Client-readable refresh token cookie (matches login-form `setClientCookie`). */
export function setRefreshTokenClientCookie(
  value: string,
  lifeSecondsEnv?: string,
): void {
  if (typeof document === "undefined") return;

  const name = refreshTokenCookieName();
  const lifeSeconds = parseInt(String(lifeSecondsEnv || "0").trim(), 10);
  const defaultSeconds = 30 * 24 * 60 * 60;
  const seconds =
    Number.isNaN(lifeSeconds) || lifeSeconds <= 0
      ? defaultSeconds
      : lifeSeconds;
  const expires = new Date(Date.now() + seconds * 1000).toUTCString();
  const encoded = encodeURIComponent(value);
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? ";Secure"
      : "";

  document.cookie = `${name}=${encoded};path=/;expires=${expires};SameSite=Lax${secure}`;
}
