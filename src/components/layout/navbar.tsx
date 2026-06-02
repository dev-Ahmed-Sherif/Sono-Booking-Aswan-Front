"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";

import {
  Activity,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Hotel,
  LogOut,
  Menu,
  Search,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

import ModeToggle from "@/components/layout/mode-toggle";
import ListComponent from "@/components/Shared/list-component";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Logout, getUserData } from "@/actions/auth";
import { setLink } from "@/redux/navSiteReducer";
import { setUserId, setOrganizationId, setRole } from "@/redux/userReducer";
import {
  canAccessHousingReceiverFromCandidates,
  canAccessHousingSenderFromCandidates,
  HOUSING_SENDER_ROLE,
  type RoleCandidates,
} from "@/lib/role-utils";

/** Avoids SSR + first client paint reading `localStorage` (hydration mismatch). */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type StoredUserBrief = RoleCandidates & { name?: string };

type NavbarProps = {
  cookie: string | null;
  locale: string;
};

const Navbar = ({ cookie, locale }: NavbarProps) => {
  const tNav = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const dispatch = useDispatch();
  const { active } = useSelector((state: any) => state.nav);
  const { role, organizationId } = useSelector((state: any) => state.user);

  const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState("/dashboard");
  const [isSuperAdmin, setIsSuperAdmin] = React.useState<boolean>(false);
  const [cookieValue, setCookieValue] = React.useState<string | null>(cookie);
  const prevCookieRef = React.useRef<string | null>(cookie);
  const isClearingCookiesRef = React.useRef<boolean>(false);
  const lastClearTimeRef = React.useRef<number>(0);
  const clearAllClientCookiesRef = React.useRef<(() => void) | null>(null);
  const nav = useLocalStorage("Nav");
  const user = useLocalStorage("user");

  /** `pending` until after mount so server HTML matches first client render (no LS on server). */
  const [storedUserBrief, setStoredUserBrief] = React.useState<
    StoredUserBrief | null | "pending"
  >("pending");

  useIsomorphicLayoutEffect(() => {
    const raw = user.getItem() as StoredUserBrief | undefined;
    setStoredUserBrief(raw ?? null);
    // Intentionally once: snapshot localStorage after mount for hydration-safe role/name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Prefer non-empty Redux, else localStorage role (only after `storedUserBrief !== "pending"`). */
  const effectiveRole = React.useMemo(() => {
    const fromRedux = String(role ?? "").trim();
    if (storedUserBrief === "pending") {
      return fromRedux.toLowerCase();
    }
    const fromStorage = storedUserBrief
      ? String(storedUserBrief.role ?? "").trim()
      : "";
    return (fromRedux || fromStorage).toLowerCase();
  }, [role, storedUserBrief]);

  const handleSheetClose = () => setSheetOpen(false);
  // console.log("Cookie :", cookie);
  // console.log("Cookie :", cookie);

  const clearAllClientCookies = React.useCallback(() => {
    const now = Date.now();
    const timeSinceLastClear = now - lastClearTimeRef.current;

    // Prevent multiple simultaneous executions
    if (isClearingCookiesRef.current) {
      console.log("Cookie clearing already in progress, skipping...");
      return;
    }

    // Prevent calls within 1 second of each other (debounce)
    if (timeSinceLastClear < 1000) {
      console.log(
        `Cookie clearing called too soon (${timeSinceLastClear}ms ago), skipping...`,
      );
      return;
    }

    // Set flag immediately to prevent concurrent executions
    isClearingCookiesRef.current = true;
    lastClearTimeRef.current = now;

    if (typeof document !== "undefined" && typeof window !== "undefined") {
      try {
        // Define paths and domains outside the loop so they can be reused
        const paths = ["/", `/${locale}`, "/ar", "/en", ""];
        const hostname = window.location.hostname;
        const domains = [
          hostname,
          `.${hostname}`,
          hostname.split(".").slice(-2).join("."), // domain without subdomain
          `.${hostname.split(".").slice(-2).join(".")}`,
          "",
        ];

        // First, specifically target Ref_guid and Ref_Tok with aggressive deletion
        // Ref_guid is set with path=/ in userReducer, so we need to match that exactly
        // First, specifically target Ref_guid_SMS_SMS and Ref_Tok_SMS with aggressive deletion
        // Ref_guid_SMS_SMS is set with path=/ in userReducer, so we need to match that exactly
        const specificCookies = ["Ref_guid_SMS", "Ref_Tok_SMS"];
        const allPaths = [
          "/",
          `/${locale}`,
          "/ar",
          "/en",
          "",
          window.location.pathname,
        ];
        const allDomains = [
          "",
          hostname,
          `.${hostname}`,
          hostname.split(".").slice(-2).join("."),
          `.${hostname.split(".").slice(-2).join(".")}`,
        ];

        // Log cookies before deletion for debugging
        console.log("Cookies before deletion:", document.cookie);

        // Try multiple times with different combinations
        for (let attempt = 0; attempt < 3; attempt++) {
          specificCookies.forEach((cookieName) => {
            allPaths.forEach((path) => {
              allDomains.forEach((domain) => {
                try {
                  // Try the exact way Ref_guid_SMS_SMS is set: path=/ with no domain
                  if (path === "/" && !domain) {
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;max-age=0`;
                  }

                  // Try without domain (most common for client-set cookies)
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};max-age=0`;
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=None`;
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=Lax`;
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=Strict`;

                  // Try with domain
                  if (domain) {
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};max-age=0`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=None`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=Lax`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=Strict`;
                  }
                } catch (e) {
                  // Ignore errors
                }
              });
            });
          });
        }

        // Get all cookies
        const cookies = document.cookie.split(";");

        // Delete each cookie by setting it to expire in the past
        cookies.forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name =
            eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

          if (!name) return;

          paths.forEach((path) => {
            domains.forEach((domain) => {
              try {
                if (domain) {
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=None;Secure`;
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
                } else {
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=None;Secure`;
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
                }
              } catch (e) {
                // Ignore errors for specific cookie deletion attempts
              }
            });
          });
        });

        // Also try to clear cookies by name if we know them
        const knownCookieNames = [
          process.env.ACCESS_TOKEN_COOKIE,
          process.env.REFRESH_TOKEN_COOKIE,
          process.env.REFRESH_GUDIE_COOKIE,
          process.env.NEXT_LOCALE,
          "Ref_guid_SMS", // Explicitly clear Ref_guid_SMS_SMS cookie
          "Ref_Tok_SMS", // Explicitly clear Ref_Tok_SMS cookie
        ].filter(Boolean);

        knownCookieNames.forEach((cookieName) => {
          if (cookieName) {
            paths.forEach((path) => {
              domains.forEach((domain) => {
                try {
                  if (domain) {
                    // Try multiple variations to ensure deletion
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=None;Secure`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=Lax`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};SameSite=Strict`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
                  } else {
                    // Try multiple variations to ensure deletion
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=None;Secure`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=Lax`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};SameSite=Strict`;
                    document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
                  }
                } catch (e) {
                  // Ignore errors
                }
              });
            });
          }
        });

        // Log cookies after deletion for debugging
        const remainingCookies = document.cookie;
        console.log("Cookies after deletion:", remainingCookies);

        // Check if Ref_guid_SMS_SMS or Ref_Tok_SMS still exist
        if (
          remainingCookies.includes("Ref_guid_SMS") ||
          remainingCookies.includes("Ref_Tok_SMS")
        ) {
          console.warn(
            "Ref_guid_SMS_SMS or Ref_Tok_SMS cookies still exist after deletion attempt. They may be HttpOnly cookies set by the server.",
          );
        } else {
          console.log("All cookies cleared successfully");
        }
      } catch (error) {
        console.error("Error clearing cookies:", error);
      }
    }

    // Always reset the flag after operation completes (with delay to prevent rapid re-execution)
    // Use a longer delay to ensure the operation fully completes
    setTimeout(() => {
      isClearingCookiesRef.current = false;
      console.log("Cookie clearing flag reset, ready for next call");
    }, 1000);
  }, [locale]);

  // Store the function in a ref so we can use it in useEffect without adding it to deps
  React.useEffect(() => {
    clearAllClientCookiesRef.current = clearAllClientCookies;
  }, [clearAllClientCookies]);

  // Update cookie value when prop changes and detect when cookie becomes null
  React.useEffect(() => {
    // Only update if cookie value actually changed
    if (prevCookieRef.current === cookie) {
      return;
    }

    // Check if cookie changed from a value to null (token expired/deleted)
    if (prevCookieRef.current !== null && cookie === null) {
      // Cookie was deleted/expired - clear cookies and local storage
      console.log("Cookie expired/deleted, clearing data...");
      // Clear all client-side cookies (only once) - use ref to avoid dependency
      if (clearAllClientCookiesRef.current) {
        clearAllClientCookiesRef.current();
      }
      // Clear local storage
      nav.removeItem();
      user.removeItem();
    }

    // Update previous cookie reference
    prevCookieRef.current = cookie;
    // Only update state if value actually changed to prevent unnecessary re-renders
    if (cookieValue !== cookie) {
      setCookieValue(cookie);
    }
  }, [cookie, cookieValue, nav.removeItem, nav.getItem, user.removeItem]);

  React.useEffect(() => {
    if (pathname === "/ar" || pathname === "/en") {
      setCookieValue(null);
    }
  }, [pathname]);

  // Read activeTab from localStorage on mount and whenever nav/cookieValue allows
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = nav.getItem();
    if (stored != null && stored !== "") {
      setActiveTab(stored);
      dispatch(setLink(stored));
    }
  }, [dispatch, nav.getItem]);

  // Keep Redux and activeTab in sync when cookie is present
  React.useEffect(() => {
    if (cookieValue === null) return;
    const activeNav = nav.getItem();
    if (activeNav != null && activeNav !== "") {
      dispatch(setLink(activeNav));
      setActiveTab(activeNav);
    } else if (activeTab !== active) {
      setActiveTab(active);
    }
  }, [dispatch, active, cookieValue, activeTab, nav.getItem]);

  // Get user role from Redux state or localStorage (client-side only)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const userRole = role || user.getItem()?.role || "";
      const superAdminCheck =
        userRole?.toLowerCase().includes("super admin") ||
        userRole?.toLowerCase().includes("superadmin") ||
        userRole === "Super Admin" ||
        userRole === "super admin";
      setIsSuperAdmin(superAdminCheck);
    }
  }, [role, user.getItem]);

  // Helper function to check if Acc_Tok_SMS cookie exists
  const checkAccTokCookie = React.useCallback(() => {
    if (typeof document === "undefined") return false;
    const cookies = document.cookie.split(";");
    return cookies.some((cookie) =>
      cookie.trim().startsWith(`${process.env.ACCESS_TOKEN_COOKIE}=`),
    );
  }, []);

  // Periodic check for user data every 2 minutes
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip if cookie is null (user not authenticated) - no need to check user data
    if (cookieValue === null) {
      return;
    }

    const checkUserData = async () => {
      // Double check cookie is still valid before proceeding
      if (cookieValue === null) {
        return;
      }

      const userData = user.getItem();

      // If user data doesn't exist
      if (!userData) {
        const hasAccTokCookie = checkAccTokCookie();

        if (hasAccTokCookie) {
          // Cookie exists but user data is missing - fetch user data
          try {
            const result = await getUserData();

            if (result?.error) {
              // If there's an error getting user data, redirect to login
              console.error("Error getting user data:", result.message);
              if (
                !isClearingCookiesRef.current &&
                clearAllClientCookiesRef.current
              ) {
                clearAllClientCookiesRef.current();
              }
              nav.removeItem();
              user.removeItem();
              router.push(`/${locale}`);
              return;
            }

            // Update user data if successful
            if (result.data?.data) {
              const d = result.data.data;
              const resolvedEmployeeId = d.employeeId ?? d.EmployeeId;
              user.setItem({
                id: d.id,
                name: d.name,
                role: d.role,
                organizationId: d.organizationId,
                ...(resolvedEmployeeId != null && resolvedEmployeeId !== ""
                  ? { employeeId: resolvedEmployeeId }
                  : {}),
              });

              // Update Redux state
              dispatch(setUserId(result.data.data.id));
              dispatch(setOrganizationId(result.data.data.organizationId));
              dispatch(setRole(result.data.data.role));
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            // On error, redirect to login
            if (
              !isClearingCookiesRef.current &&
              clearAllClientCookiesRef.current
            ) {
              clearAllClientCookiesRef.current();
            }
            nav.removeItem();
            user.removeItem();
            router.push(`/${locale}`);
          }
        } else {
          // No cookie and no user data - redirect to login
          if (
            !isClearingCookiesRef.current &&
            clearAllClientCookiesRef.current
          ) {
            clearAllClientCookiesRef.current();
          }
          nav.removeItem();
          user.removeItem();
          router.push(`/${locale}`);
        }
      }
    };

    // Run check immediately
    checkUserData();

    // Set up interval to check every 2 minutes (120000ms)
    const intervalId = setInterval(checkUserData, 120000);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieValue]); // Only depend on cookieValue - other deps are stable or accessed via refs

  const routes = React.useMemo(() => {
    const allRoutes = [
      {
        id: 1,
        href: `/${locale}/dashboard`,
        label: tNav("dashboard"),
        active: pathname === `/${locale}/dashboard`,
      },
      {
        id: 2,
        href: `/${locale}/reservation`,
        label: tNav("reservation"),
        active:
          pathname === `/${locale}/reservation` ||
          pathname.startsWith(`/${locale}/reservation/`),
      },
      {
        id: 3,
        href: `/${locale}/housing-receiver`,
        label: tNav("housingReceiver"),
        active: pathname === `/${locale}/housing-receiver`,
      },
      {
        id: 4,
        href: `/${locale}/housing-sender`,
        label: tNav("housingSender"),
        active: pathname === `/${locale}/housing-sender`,
      },
      {
        id: 5,
        href: `/${locale}/settings`,
        label: tNav("settings"),
        active:
          pathname === `/${locale}/settings` ||
          pathname.startsWith(`/${locale}/settings/`),
      },
    ];

    const normalizedRole = effectiveRole;
    const roleCandidates: RoleCandidates = {
      role: normalizedRole || undefined,
      ...(storedUserBrief !== "pending" && storedUserBrief
        ? {
            roleName: storedUserBrief.roleName,
            roleEn: storedUserBrief.roleEn,
            roleAr: storedUserBrief.roleAr,
          }
        : {}),
    };

    if (normalizedRole === "user") {
      return allRoutes.filter(
        (route) => route.href === `/${locale}/reservation`,
      );
    }
    if (normalizedRole === HOUSING_SENDER_ROLE) {
      return allRoutes.filter(
        (route) =>
          route.href === `/${locale}/dashboard` ||
          route.href === `/${locale}/housing-sender`,
      );
    }
    if (canAccessHousingReceiverFromCandidates(roleCandidates)) {
      return allRoutes.filter(
        (route) => route.href === `/${locale}/housing-receiver`,
      );
    }

    return allRoutes.filter((route) => {
      if (route.href === `/${locale}/housing-sender`) {
        return canAccessHousingSenderFromCandidates(roleCandidates);
      }
      if (route.href === `/${locale}/housing-receiver`) {
        return canAccessHousingReceiverFromCandidates(roleCandidates);
      }
      return true;
    });
  }, [locale, pathname, effectiveRole, storedUserBrief, tNav]);

  const navHomeHref = React.useMemo(() => {
    if (effectiveRole === "user") {
      return `/${locale}/reservation`;
    }
    const roleCandidates: RoleCandidates = {
      role: effectiveRole || undefined,
      ...(storedUserBrief !== "pending" && storedUserBrief
        ? {
            roleName: storedUserBrief.roleName,
            roleEn: storedUserBrief.roleEn,
            roleAr: storedUserBrief.roleAr,
          }
        : {}),
    };
    if (canAccessHousingReceiverFromCandidates(roleCandidates)) {
      return `/${locale}/housing-receiver`;
    }
    return `/${locale}/dashboard`;
  }, [effectiveRole, storedUserBrief, locale]);

  // Keep active tab in sync with current pathname (e.g. when landing on /ar/settings)
  React.useEffect(() => {
    if (pathname && pathname.startsWith(`/${locale}/`)) {
      setActiveTab(pathname);
    }
  }, [pathname, locale]);

  const navClicks = (href: string) => {
    setActiveTab(href);
    dispatch(setLink(href));
    nav.setItem(href);
  };

  // Helper function to clear all cookies on client side

  const logout = () => {
    const User = user.getItem();
    console.log("User", User);

    // Clear all client-side cookies immediately (only if not already clearing)
    if (!isClearingCookiesRef.current && clearAllClientCookiesRef.current) {
      clearAllClientCookiesRef.current();
    }

    // Check if user data exists and has an id
    if (User && User.id) {
      Logout(User.id)
        .then((data) => {
          console.log("data", data);
          // Clear cookies again after server-side logout (only if not already clearing)
          if (
            !isClearingCookiesRef.current &&
            clearAllClientCookiesRef.current
          ) {
            clearAllClientCookiesRef.current();
          }
          if (locale === "ar") {
            setTimeout(() => {
              nav.removeItem();
              user.removeItem();
              router.push("/ar");
              setTimeout(() => {
                window.location.reload();
              }, 35);
            }, 700);
          } else {
            setTimeout(() => {
              nav.removeItem();
              user.removeItem();
              router.push("/en");
              setTimeout(() => {
                window.location.reload();
              }, 35);
            }, 700);
          }
        })
        .catch((err) => {
          console.log(err);
          // Clear cookies even if logout API call fails (only if not already clearing)
          if (
            !isClearingCookiesRef.current &&
            clearAllClientCookiesRef.current
          ) {
            clearAllClientCookiesRef.current();
          }
          // Even if logout API call fails, clear local storage and redirect
          if (locale === "ar") {
            router.push("/ar");
          } else {
            router.push("/en");
          }
          setTimeout(() => {
            nav.removeItem();
            user.removeItem();
          }, 700);
        });
    } else {
      // If user data is missing, just clear local storage and redirect
      console.warn(
        "User data not found, clearing local storage and redirecting",
      );
      if (!isClearingCookiesRef.current && clearAllClientCookiesRef.current) {
        clearAllClientCookiesRef.current();
      }
      if (locale === "ar") {
        router.push("/ar");
      } else {
        router.push("/en");
      }
      setTimeout(() => {
        nav.removeItem();
        user.removeItem();
      }, 700);
    }
  };

  // If cookie is null/undefined (user not authenticated), still show navigation links
  if (cookie == null) {
    return (
      <header className="sticky top-0 z-[9999] w-full max-w-full min-w-0 overflow-hidden py-10 h-20 flex items-center gap-2 sm:gap-4 border-b bg-background px-4 md:px-6 lg:px-8">
        <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <ModeToggle />
        </div>
      </header>
    );
  }

  // If cookie exists (user authenticated), show full navbar
  return (
    <header className="sticky top-0 z-[9999] w-full max-w-full min-w-0 overflow-hidden py-10 h-20 flex items-center gap-2 sm:gap-4 border-b bg-background px-4 md:px-6 lg:px-8">
      <Link
        href={navHomeHref}
        className="hidden min-[771px]:flex md:shrink-0 md:items-center md:gap-2 md:font-semibold md:text-lg"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md">
          <Hotel className="h-7 w-7" />
        </span>
        <span className="sr-only">SMS</span>
      </Link>
      <nav className="hidden flex-col gap-2 font-medium min-[771px]:flex md:flex-row md:items-center md:min-w-0 md:flex-1 md:justify-start md:text-sm md:gap-1 lg:gap-2">
        <ListComponent
          data={routes}
          animationType="slide"
          delay={0.2}
          duration={0.6}
          renderItem={(route, index) => (
            <Link
              key={route.id}
              href={route.href}
              onClick={() => navClicks(route.href)}
              className={cn(
                "relative flex items-center justify-center text-base text-balance text-center font-medium transition-all duration-300 hover:text-gray-900 dark:hover:text-white hover:scale-105 group rounded-full px-2 lg:px-4 shrink-0",
                activeTab === route.href
                  ? "text-gray-900 dark:text-white"
                  : "text-muted-foreground",
              )}
            >
              {activeTab === route.href && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute w-full px-1 inset-0 bg-gradient-to-r from-primary/60 to-secondary/60 hover:from-primary/70 hover:to-secondary/50 dark:from-primary/70 dark:to-secondary dark:hover:from-primary/60 dark:hover:to-secondary/80 rounded-full shadow-lg dark:shadow-primary/20"
                  transition={{
                    type: "spring",
                    duration: 0.6,
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}
              <motion.p
                className="relative py-2 rounded-full font-bold dark:hover:text-secondary-foreground group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300 whitespace-nowrap"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {route.label}
              </motion.p>
            </Link>
          )}
        />
      </nav>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 min-[771px]:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <VisuallyHidden>
            <SheetTitle>قائمة التنقل</SheetTitle>
            <SheetDescription>قائمة التنقل الرئيسية</SheetDescription>
          </VisuallyHidden>
          <nav className="px-10 grid items-center justify-center gap-6 text-lg font-medium">
            <Link
              href={navHomeHref}
              className="flex items-center justify-center gap-2 text-lg font-semibold"
              onClick={handleSheetClose}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md">
                <Hotel className="h-7 w-7" />
              </span>
              <span className="sr-only">Network Ticket</span>
            </Link>
            <ListComponent
              data={routes}
              animationType="stagger"
              delay={0.1}
              duration={0.4}
              renderItem={(route, index) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "relative w-full max-w-48 flex items-center justify-center text-base text-balance text-center font-medium transition-all duration-300 hover:text-gray-900 dark:hover:text-white hover:scale-105 group rounded-xl py-3 px-4 mb-2",
                    activeTab === route.href
                      ? "text-gray-900 dark:text-white"
                      : "text-muted-foreground",
                  )}
                  onClick={() => {
                    navClicks(route.href);
                    handleSheetClose();
                  }}
                >
                  {activeTab === route.href && (
                    <motion.div
                      layoutId="active-pill-mobile"
                      className="absolute w-full h-full inset-0 bg-gradient-to-b from-primary/60 to-secondary/60 hover:from-primary/70 hover:to-secondary/50 dark:from-primary/70 dark:to-secondary dark:hover:from-primary/60 dark:hover:to-secondary/80 rounded-xl shadow-lg dark:shadow-primary/20"
                      transition={{
                        type: "spring",
                        duration: 0.6,
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                  <motion.span
                    className="relative z-10 font-semibold dark:hover:text-secondary-foreground group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300"
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {route.label}
                  </motion.span>
                </Link>
              )}
            />
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center justify-end gap-2 sm:gap-4 md:ml-auto md:gap-4 flex-wrap min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[min(100%,22rem)]">
            <span className="text-base font-medium text-muted-foreground shrink-0 sm:text-lg">
              {tNav("welcome")}
            </span>
            <Link
              href={`/${locale}/account`}
              className="truncate min-w-0 rounded-md px-2 py-0.5 text-base font-bold text-foreground underline-offset-4 transition-colors hover:bg-blue-500/15 hover:text-blue-600 hover:underline dark:hover:bg-blue-400/20 dark:hover:text-blue-400 sm:text-lg"
            >
              {storedUserBrief === "pending"
                ? tNav("accountFallback")
                : storedUserBrief?.name || tNav("accountFallback")}
            </Link>
          </div>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => logout()}
            className="shrink-0 h-10 gap-2 border-destructive/30 px-3 text-base font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-11 sm:px-4 sm:text-lg"
            aria-label={tNav("logout")}
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            <span className="hidden sm:inline">{tNav("logout")}</span>
          </Button>
        </div>
        <ModeToggle />
      </div>
    </header>
  );
};

export default Navbar;
