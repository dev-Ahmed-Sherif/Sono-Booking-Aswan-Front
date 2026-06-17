import axios from "axios";

import { toPlainSerializable } from "@/lib/to-plain-serializable";
import {
  getAccessToken,
  getRefreshToken,
  getUserId,
  setAccessToken,
} from "@/lib/token-helper";

export type RefreshResult =
  | { ok: true; refreshToken?: string }
  | { error: string; message?: string };

let refreshInFlight: Promise<RefreshResult> | null = null;

async function performRefresh(): Promise<RefreshResult> {
  const [userId, accessToken, refreshToken] = await Promise.all([
    getUserId(),
    getAccessToken(),
    getRefreshToken(),
  ]);

  if (!userId || !accessToken || !refreshToken) {
    return {
      error: "Unauthorized",
      message: "Missing session data. Please login again.",
    };
  }

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/accounts/refresh`,
      { userId, accessToken, refreshToken },
      {
        headers: {
          "Content-Type": "application/json",
          withCredentials: true,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const plainRoot = toPlainSerializable(res.data) as Record<
      string,
      unknown
    > | null;

    if (!plainRoot || typeof plainRoot !== "object") {
      return {
        error: "Failed to refresh token",
        message: "Invalid response from server",
      };
    }

    const inner = (plainRoot.data ?? plainRoot) as Record<string, unknown>;
    const isLoggedIn = Boolean(inner.isLogedIn ?? inner.isLoggedIn);
    const access = inner.accessToken ?? inner.AccessToken;

    if (!isLoggedIn || typeof access !== "string" || !access) {
      return {
        error: "Unauthorized",
        message: "Refresh token is invalid or expired. Please login again.",
      };
    }

    await setAccessToken(access);

    const nextRefresh =
      inner.refreshToken ??
      inner.RefreshToken ??
      (plainRoot.refreshToken as string | undefined);

    return {
      ok: true,
      refreshToken: typeof nextRefresh === "string" ? nextRefresh : undefined,
    };
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      error: "Unauthorized",
      message:
        err.response?.data?.message ||
        err.message ||
        "Failed to refresh token. Please login again.",
    };
  }
}

/** Deduplicated refresh — concurrent 401s share one in-flight request. */
export async function refreshAccessTokenOnce(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
