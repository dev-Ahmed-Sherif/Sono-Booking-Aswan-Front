/** Strip `/api/v1`, `/wwwroot`, and trailing slashes from a backend base URL. */
function normalizeApiOrigin(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v\d+$/i, "")
    .replace(/\/wwwroot$/i, "");
}

const HUB_PROXY_BASE = "/api/v1/hubs";

function resolveHubUrlFromEnv(
  suffix: "chat" | "notifications" | "video",
): string {
  const envKey =
    suffix === "chat"
      ? process.env.NEXT_PUBLIC_SIGNALR_HUB_URL
      : suffix === "notifications"
        ? process.env.NEXT_PUBLIC_NOTIFICATION_HUB_URL
        : process.env.NEXT_PUBLIC_VIDEO_HUB_URL;

  const explicit = (envKey ?? "").trim();
  if (explicit) return explicit;

  const fromBackEnd = (process.env.NEXT_PUBLIC_BACK_END ?? "").trim();
  const origin = normalizeApiOrigin(fromBackEnd);
  return origin ? `${origin}/api/v1/hubs/${suffix}` : "";
}

/**
 * Browser-reachable hub URL.
 * Prefer `NEXT_PUBLIC_*_HUB_URL` or `NEXT_PUBLIC_BACK_END` (direct API origin).
 * Next.js rewrites do not reliably proxy SignalR WebSocket/SSE/long-poll streams.
 * Same-origin `/api/v1/hubs/*` is only used when no env base is configured.
 */
function resolveBrowserHubUrl(suffix: "chat" | "notifications" | "video"): string {
  const fromEnv = resolveHubUrlFromEnv(suffix);
  if (fromEnv) {
    return fromEnv;
  }
  return `${HUB_PROXY_BASE}/${suffix}`;
}

export function getSignalRHubUrl(): string {
  if (typeof window !== "undefined") {
    return resolveBrowserHubUrl("chat");
  }
  return resolveHubUrlFromEnv("chat");
}

export function getNotificationHubUrl(): string {
  if (typeof window !== "undefined") {
    return resolveBrowserHubUrl("notifications");
  }
  return resolveHubUrlFromEnv("notifications");
}

export function getVideoHubUrl(): string {
  if (typeof window !== "undefined") {
    return resolveBrowserHubUrl("video");
  }
  return resolveHubUrlFromEnv("video");
}
