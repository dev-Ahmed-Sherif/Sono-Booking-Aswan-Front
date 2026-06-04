import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { accessTokenCookieName, localeCookieName } from "@/lib/auth-cookies";
// export default createMiddleware({
//   // A list of all locales that are supported
//   locales: ["en", "ar"],

//   // Used when no locale matches
//   defaultLocale: "ar",
// });
const publicPages = ["/ar", "/en", "/ar/register", "/en/register"];
const LAST_ROUTE_COOKIE = "last_route";

function isLocaleRootPath(pathname: string) {
  return (
    pathname === "/ar" ||
    pathname === "/en" ||
    pathname === "/ar/" ||
    pathname === "/en/"
  );
}

function isValidLastRoute(pathname: string, currentPathname: string) {
  return !isLocaleRootPath(pathname) && pathname !== currentPathname;
}

function hasAuthSession(req: NextRequest): boolean {
  const access = req.cookies.get(accessTokenCookieName())?.value?.trim();
  return Boolean(access);
}

function defaultLocale(req: NextRequest): string {
  const locale = req.cookies.get(localeCookieName())?.value?.trim();
  if (locale === "ar" || locale === "en") return locale;
  const segment = req.nextUrl.pathname.split("/")[1];
  if (segment === "ar" || segment === "en") return segment;
  return "ar";
}

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ["en", "ar"],

  // Used when no locale matches
  defaultLocale: "ar",
});

export async function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  const { origin } = nextUrl;

  // Handle Chrome DevTools requests - return 204 to suppress 404 errors
  if (nextUrl.pathname.startsWith("/.well-known/")) {
    return new NextResponse(null, { status: 204 });
  }

  // App Router API / tRPC: skip locale + auth redirect so Route Handlers run (they enforce auth themselves).
  if (
    nextUrl.pathname.startsWith("/api") ||
    nextUrl.pathname.startsWith("/trpc")
  ) {
    return NextResponse.next();
  }

  const authenticated = hasAuthSession(req);
  const activeLocale = defaultLocale(req);

  if (!authenticated && !publicPages.includes(nextUrl.pathname)) {
    const redirectUrl = new URL(`${origin}/${activeLocale}`);
    // Add reload parameter to trigger client-side reload
    redirectUrl.searchParams.set("reload", "true");

    // Create redirect response with cache-control headers to force fresh load
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  }

  // if (authenticated && publicPages.includes(nextUrl.pathname)) {
  //   const localeFromPath = nextUrl.pathname.split("/")[1];
  //   const activeLocale =
  //     localeFromPath === "ar" || localeFromPath === "en"
  //       ? localeFromPath
  //       : locale?.value === "en"
  //         ? "en"
  //         : "ar";

  //   const referer = req.headers.get("referer");
  //   const savedLastRoute = cookies.get(LAST_ROUTE_COOKIE)?.value;
  //   let redirectTarget = `/${activeLocale}/dashboard`;

  //   if (savedLastRoute) {
  //     try {
  //       const savedUrl = new URL(savedLastRoute, origin);
  //       if (isValidLastRoute(savedUrl.pathname, nextUrl.pathname)) {
  //         redirectTarget = `${savedUrl.pathname}${savedUrl.search}`;
  //       }
  //     } catch {
  //       // Ignore malformed saved route.
  //     }
  //   }

  //   // Middleware cannot access browser history directly; use referer as last navigation hint.
  //   if (referer && redirectTarget === `/${activeLocale}/dashboard`) {
  //     try {
  //       const refererUrl = new URL(referer);
  //       const isSameOrigin = refererUrl.origin === origin;
  //       const shouldUseReferer = isValidLastRoute(
  //         refererUrl.pathname,
  //         nextUrl.pathname,
  //       );

  //       if (isSameOrigin && shouldUseReferer) {
  //         redirectTarget = `${refererUrl.pathname}${refererUrl.search}`;
  //       }
  //     } catch {
  //       // Keep fallback redirect when referer cannot be parsed.
  //     }
  //   }

  //   const response = NextResponse.redirect(new URL(redirectTarget, origin));
  //   return response;
  // }

  // const response = intlMiddleware(req);

  // if (
  //   accessCookie !== null &&
  //   (nextUrl.pathname.startsWith("/ar/") || nextUrl.pathname.startsWith("/en/"))
  // ) {
  //   const currentRoute = `${nextUrl.pathname}${nextUrl.search}`;
  //   response.cookies.set(LAST_ROUTE_COOKIE, currentRoute, {
  //     httpOnly: true,
  //     sameSite: "lax",
  //     path: "/",
  //   });
  // }

  return intlMiddleware(req);
}

export const config = {
  // Match only internationalized pathnames
  matcher: [
    "/",
    "/(ar|en)/:path*",
    // "/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|favicon.svg|images/books|icons|manifest).*)",
    "/((?!.*\\..*|_next).*)",
    "/(api|trpc)(.*)",
    // "/img/:path*",
  ],
};
