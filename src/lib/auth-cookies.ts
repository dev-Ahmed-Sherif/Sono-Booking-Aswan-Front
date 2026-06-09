/** Shared auth cookie names (trim .env values; fallbacks match `.env`). */

/**
 * Optional cookie domain. Leave unset for host-only cookies (Vercel preview, localhost).
 * Set to `.sono.net` only when the app is served from `*.sono.net`.
 */
export function authCookieDomain(): string | undefined {
  const raw = (
    process.env.COOKIE_DOMAIN ?? process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? ""
  ).trim();
  return raw || undefined;
}

export function accessTokenCookieName(): string {
  return (
    (
      process.env.ACCESS_TOKEN_COOKIE ??
      process.env.NEXT_PUBLIC_ACCESS_TOKEN_COOKIE ??
      ""
    ).trim() || "Acc_Tok_Sono_Booking"
  );
}

export function refreshTokenCookieName(): string {
  return (
    (
      process.env.REFRESH_TOKEN_COOKIE ??
      process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE ??
      ""
    ).trim() || "Ref_Tok_Sono_Booking"
  );
}

export function guideCookieName(): string {
  return (
    (
      process.env.REFRESH_GUIDE_COOKIE ??
      process.env.REFRESH_GUDIE_COOKIE ??
      process.env.NEXT_PUBLIC_REFRESH_GUIDE_COOKIE ??
      process.env.NEXT_PUBLIC_REFRESH_GUDIE_COOKIE ??
      ""
    ).trim() || "Ref_Guid_Sono_Booking"
  );
}

export function localeCookieName(): string {
  return (process.env.NEXT_LOCALE ?? "").trim() || "NEXT_LOCALE";
}
