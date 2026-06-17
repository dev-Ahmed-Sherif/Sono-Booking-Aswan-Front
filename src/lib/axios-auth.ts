import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { getAccessToken } from "@/lib/token-helper";
import { refreshAccessTokenOnce } from "@/lib/refresh-access-token";

type RetryConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

let interceptorInstalled = false;

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes("/accounts/login") ||
    url.includes("/accounts/logout") ||
    url.includes("/accounts/register") ||
    url.includes("/accounts/refresh") ||
    url.includes("/accounts/forgotPassword")
  );
}

function hasAuthorizationHeader(config: RetryConfig): boolean {
  const headers = config.headers;
  if (!headers) return false;
  const auth =
    (headers as Record<string, unknown>).Authorization ??
    (headers as Record<string, unknown>).authorization;
  return typeof auth === "string" && auth.trim().length > 0;
}

function ensureAuthInterceptor(): void {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;

      if (
        !config ||
        config._authRetried ||
        error.response?.status !== 401 ||
        isAuthEndpoint(config.url ?? "") ||
        !hasAuthorizationHeader(config)
      ) {
        return Promise.reject(error);
      }

      config._authRetried = true;

      const refreshResult = await refreshAccessTokenOnce();
      if ("error" in refreshResult) {
        return Promise.reject(error);
      }

      const newToken = await getAccessToken();
      if (!newToken) {
        return Promise.reject(error);
      }

      if (config.headers) {
        if (typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${newToken}`);
        } else {
          (config.headers as Record<string, string>).Authorization =
            `Bearer ${newToken}`;
        }
      }

      return axios(config);
    },
  );
}

ensureAuthInterceptor();

export default axios;

export function isAxiosUnauthorized(error: unknown): boolean {
  const err = error as { response?: { status?: number } };
  return err.response?.status === 401;
}
