/**
 * Notification backend contract — align with ASP.NET NotificationHub + REST API.
 *
 * ## REST (base: `process.env.BACK_END`, typically `.../api/v1`)
 *
 * | Method | Path | Notes |
 * |--------|------|--------|
 * | GET | `/notifications?take=20&onlyUnread=false` | List notifications |
 * | GET | `/notifications/unread-count` | `{ count: number }` |
 * | PATCH | `/notifications/{id}/read` | Mark one read |
 * | PATCH | `/notifications/read-all` | Mark all read |
 *
 * ## SignalR
 *
 * - **Hub URL:** `NEXT_PUBLIC_NOTIFICATION_HUB_URL` or derived from chat hub URL
 * - **Auth:** JWT via `accessTokenFactory` (see `/api/signalr/access-token`)
 *
 * **Server → client (On):**
 * - `ReceiveNotification` — notification DTO
 * - `UnreadCountUpdated` — `(count: number)`
 */

export const NOTIFICATION_API_PATHS = {
  list: "/notifications",
  unreadCount: "/notifications/unread-count",
  markRead: (id: string) => `/notifications/${encodeURIComponent(id)}/read`,
  markAllRead: "/notifications/read-all",
} as const;

export const NOTIFICATION_HUB_EVENTS = {
  receiveNotification: "ReceiveNotification",
  unreadCountUpdated: "UnreadCountUpdated",
} as const;
