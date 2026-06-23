/**
 * Chat backend contract — align these paths and SignalR names with your ASP.NET API.
 *
 * ## REST (base: `process.env.BACK_END`, typically `.../api/v1`)
 *
 * | Method | Path | Notes |
 * |--------|------|--------|
 * | GET | `/chat/conversations` | List conversations for current user |
 * | GET | `/chat/contacts` | Role-filtered users the current user may chat with |
 * | GET | `/chat/online-status?userIds=` | Batch online flags from `User.IsLogedIn` (REST fallback for presence) |
 * | GET | `/chat/conversations/{id}/messages?take=50&before={messageId}` | Paginated history (`before` optional) |
 * | POST | `/chat/conversations` | Body: `{ participantUserIds: string[] }` — create or open direct thread |
 * | POST | `/chat/messages` | Body: `{ conversationId: string, content: string }` — send when not using hub only |
 *
 * Response shapes may wrap in `{ data: T }` or return `T` directly; `chatService` normalizes both.
 *
 * ## SignalR
 *
 * - **Hub URL:** `NEXT_PUBLIC_SIGNALR_HUB_URL` (browser-reachable, e.g. `https://host/api/v1/hubs/chat`)
 * - **Auth:** JWT via `accessTokenFactory` (see `/api/signalr/access-token`)
 *
 * **Client → server (Invoke):**
 * - `JoinConversation` — `(conversationId: string)`
 * - `LeaveConversation` — `(conversationId: string)`
 * - `SendMessage` — `(conversationId: string, content: string)`
 * - `GetOnlineStatuses` — `(userIds: string[])` → `{ userId, isOnline }[]`
 *
 * **Server → client (On):**
 * - `ReceiveMessage` — message DTO (same fields as `chatMessageSchema`)
 * - `ConversationUpdated` — partial conversation / unread metadata (optional)
 * - `UserPresenceChanged` — `(userId: string, isOnline: boolean)` or legacy `{ userId, isOnline }`
 */

export const CHAT_API_PATHS = {
  conversations: "/chat/conversations",
  contacts: "/chat/contacts",
  onlineStatus: "/chat/online-status",
  messages: (conversationId: string) =>
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  createConversation: "/chat/conversations",
  sendMessageRest: "/chat/messages",
  requestConversations: (requestId: string, groupType?: string) => {
    const base = `/chat/requests/${encodeURIComponent(requestId)}/conversations`;
    if (!groupType?.trim()) return base;
    const params = new URLSearchParams({ groupType: groupType.trim() });
    return `${base}?${params.toString()}`;
  },
  createRequestConversation: (requestId: string) =>
    `/chat/requests/${encodeURIComponent(requestId)}/conversations`,
} as const;

/** Request-scoped role-based chat group types (must match backend). */
export const REQUEST_CHAT_GROUP_TYPES = {
  ownerLeader: "owner-leader",
  leaderReception: "leader-reception",
  ownerReception: "owner-reception",
} as const;

export type RequestChatGroupType =
  (typeof REQUEST_CHAT_GROUP_TYPES)[keyof typeof REQUEST_CHAT_GROUP_TYPES];

/** Server → client event names (C# hub method names are PascalCase). */
export const CHAT_HUB_EVENTS = {
  receiveMessage: "ReceiveMessage",
  conversationUpdated: "ConversationUpdated",
  userPresenceChanged: "UserPresenceChanged",
} as const;

/** Client → server hub method names. */
export const CHAT_HUB_METHODS = {
  joinConversation: "JoinConversation",
  leaveConversation: "LeaveConversation",
  sendMessage: "SendMessage",
  getOnlineStatuses: "GetOnlineStatuses",
} as const;

export type UserOnlineStatus = {
  userId: string;
  isOnline: boolean;
};

export type UserPresenceChangedPayload = UserOnlineStatus;
