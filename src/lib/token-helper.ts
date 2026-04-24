"use server";

import { cookies } from "next/headers";

// Helper to get cookies (handles both sync and async)
const getCookies = async () => {
  const cookiesResult = cookies();
  // Always await - if it's a Promise, await it; if it's already resolved, it returns immediately
  return await Promise.resolve(cookiesResult);
};

export const getAccessToken = async () => {
  const backEndCookies = await getCookies();
  return backEndCookies.get(`${process.env.ACCESS_TOKEN_COOKIE}`)?.value;
};

export const getRefreshToken = async () => {
  const backEndCookies = await getCookies();
  const name =
    process.env.REFRESH_TOKEN_COOKIE ??
    process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE;
  if (!name) return undefined;
  return backEndCookies.get(name)?.value;
};

// Cookie maxAge/expires: env value is in SECONDS (e.g. 604800 = 7 days)
const getAccessTokenLifeSeconds = () => {
  const raw = process.env.NEXT_PUBLIC_ACCESS_TOKEN_LIFE ?? "";
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) {
    return 7 * 24 * 60 * 60; // default 7 days in seconds
  }
  return n;
};

// Cookie management helpers
export const setAccessToken = async (token: string) => {
  const backEndCookies = await getCookies();
  const maxAgeSeconds = getAccessTokenLifeSeconds();
  backEndCookies.set({
    name: `${process.env.ACCESS_TOKEN_COOKIE}`,
    value: token,
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "strict",
    expires: new Date(Date.now() + maxAgeSeconds * 1000),
    maxAge: maxAgeSeconds,
    domain: process.env.NODE_ENV === "production" ? ".sono.net" : "localhost",
    priority: "high",
  });
};

export const clearAccessToken = async () => {
  const backEndCookies = await getCookies();
  backEndCookies.delete(`${process.env.ACCESS_TOKEN_COOKIE}`);
};
