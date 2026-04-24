/**
 * Chat backend contract — align these paths and SignalR names with your ASP.NET API.
 *
 * ## REST (base: `process.env.BACK_END`, typically `.../api/v1`)
 *
 * | Method | Path | Notes |
 * |--------|------|--------|
 * | GET | `/chat/conversations` | List conversations for current user |
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
 *
 * **Server → client (On):**
 * - `ReceiveMessage` — message DTO (same fields as `chatMessageSchema`)
 * - `ConversationUpdated` — partial conversation / unread metadata (optional)
 */

export const CHAT_API_PATHS = {
  conversations: "/chat/conversations",
  messages: (conversationId: string) =>
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  createConversation: "/chat/conversations",
  sendMessageRest: "/chat/messages",
} as const;

/** Server → client event names (C# hub method names are PascalCase). */
export const CHAT_HUB_EVENTS = {
  receiveMessage: "ReceiveMessage",
  conversationUpdated: "ConversationUpdated",
} as const;

/** Client → server hub method names. */
export const CHAT_HUB_METHODS = {
  joinConversation: "JoinConversation",
  leaveConversation: "LeaveConversation",
  sendMessage: "SendMessage",
} as const;
