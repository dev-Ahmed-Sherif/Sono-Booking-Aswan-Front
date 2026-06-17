"use client";

import { useEffect } from "react";

import { setRefreshTokenClientCookie } from "@/lib/client-auth-cookies";

const CHECK_INTERVAL_MS = 60_000;

async function refreshSessionIfNeeded(): Promise<void> {
  try {
    const statusRes = await fetch("/api/auth/check-session", {
      credentials: "include",
      cache: "no-store",
    });

    if (!statusRes.ok) return;

    const status = (await statusRes.json()) as {
      authenticated?: boolean;
      shouldRefresh?: boolean;
    };

    if (!status.authenticated || !status.shouldRefresh) return;

    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    if (!refreshRes.ok) return;

    const body = (await refreshRes.json()) as { refreshToken?: string };
    if (body.refreshToken?.trim()) {
      setRefreshTokenClientCookie(
        body.refreshToken.trim(),
        process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE_LIFE,
      );
    }
  } catch {
    // Ignore background refresh errors; the next API call will surface auth issues.
  }
}

/** Proactively refreshes tokens before the access JWT expires. */
export function AuthTokenRefresh() {
  useEffect(() => {
    void refreshSessionIfNeeded();
    const id = window.setInterval(() => {
      void refreshSessionIfNeeded();
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
