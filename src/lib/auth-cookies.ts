/** Shared auth cookie names (trim .env values; fallbacks match `.env`). */

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
