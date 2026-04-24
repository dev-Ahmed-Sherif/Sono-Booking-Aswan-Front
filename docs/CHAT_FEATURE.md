# Chat feature (REST + SignalR) — implementation reference

This document lists everything added or changed to implement the chat feature per the integration plan: REST for history and mutations, SignalR for realtime, httpOnly JWT bridged for the browser client.

---

## New files

| Path | Purpose |
|------|---------|
| [`src/actions/chat/chatApi.contract.ts`](../src/actions/chat/chatApi.contract.ts) | Documented REST paths, hub URL/env, SignalR invoke/on event names, exported `CHAT_API_PATHS`, `CHAT_HUB_EVENTS`, `CHAT_HUB_METHODS`. |
| [`src/actions/chat/chatService.ts`](../src/actions/chat/chatService.ts) | Server actions: `getChatConversations`, `getChatMessages`, `createChatConversation`, `sendChatMessageRest` (Bearer via `getAccessToken`, Axios, normalized `{ data }` responses). |
| [`src/schemas/chat.ts`](../src/schemas/chat.ts) | Zod schemas: `chatConversationSchema`, `chatMessageSchema`, `createChatConversationSchema`, `sendChatMessageSchema`; types `ChatConversation`, `ChatMessage`. |
| [`src/app/api/signalr/access-token/route.ts`](../src/app/api/signalr/access-token/route.ts) | `GET` Route Handler: reads `ACCESS_TOKEN_COOKIE`, returns `{ accessToken }` or **401**. |
| [`src/lib/chat-env.ts`](../src/lib/chat-env.ts) | `getSignalRHubUrl()` reads `NEXT_PUBLIC_SIGNALR_HUB_URL`. |
| [`src/lib/signalr/chat-hub.ts`](../src/lib/signalr/chat-hub.ts) | Client-only: `buildChatHubConnection`, `fetchAccessToken` from same-origin API, `HubConnectionBuilder` + `withAutomaticReconnect`, registers `ReceiveMessage` / `ConversationUpdated`. |
| [`src/hooks/useChatConnection.ts`](../src/hooks/useChatConnection.ts) | Manages hub lifecycle: start/stop, `JoinConversation` / `LeaveConversation`, `sendViaHub`, connection state, `visibilitychange` reconnect attempt. |
| [`src/components/chat/chat-view.tsx`](../src/components/chat/chat-view.tsx) | Main UI: conversation list, new chat (participant IDs), thread, composer; REST fallback when hub disconnected; RTL for `ar`; toasts for errors. |
| [`src/app/[locale]/chat/page.tsx`](../src/app/[locale]/chat/page.tsx) | App Router page rendering `ChatView` with `locale`. |

---

## Modified files

| Path | Change |
|------|--------|
| [`src/schemas/index.ts`](../src/schemas/index.ts) | `export * from "./chat";` |
| [`src/middleware.ts`](../src/middleware.ts) | Early `NextResponse.next()` for paths starting with `/api` or `/trpc` so Route Handlers are not forced through locale/auth redirect behavior. |
| [`src/components/layout/navbar.tsx`](../src/components/layout/navbar.tsx) | `useTranslations("Nav")`; chat route `/${locale}/chat` (id `10`) with `tNav("chat")`; `routes` wrapped in `React.useMemo`. |
| [`src/messages/ar.json`](../src/messages/ar.json) | `Nav.chat`, full `Chat.*` strings. |
| [`src/messages/en.json`](../src/messages/en.json) | `Nav.chat`, full `Chat.*` strings. |
| [`package.json`](../package.json) / `package-lock.json` | Dependency **`@microsoft/signalr`** (e.g. `^8.0.7`). |

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `BACK_END` | Server (existing) | REST base URL for chat endpoints (same as rest of app). |
| `ACCESS_TOKEN_COOKIE` | Server (existing) | Cookie name; used by token Route Handler. |
| **`NEXT_PUBLIC_SIGNALR_HUB_URL`** | Client | Full SignalR hub URL the browser can reach (e.g. `https://api.example.com/api/v1/hubs/chat`). If unset, realtime is disabled; UI can still try REST send if API supports it. |

---

## Backend contract (summary)

Align with your API; defaults assumed in code:

### REST (relative to `BACK_END`)

- `GET /chat/conversations` — list conversations.
- `GET /chat/conversations/{id}/messages?take=&before=` — message history.
- `POST /chat/conversations` — body `{ participantUserIds: string[] }`.
- `POST /chat/messages` — body `{ conversationId, content }`.

Responses may be raw arrays/objects or wrapped in `{ data: ... }`; `chatService` unwraps `data` when present.

### SignalR

- **Invoke:** `JoinConversation`, `LeaveConversation`, `SendMessage` (see contract file for parameters).
- **On:** `ReceiveMessage`, `ConversationUpdated` (optional).

---

## User-facing entry

- **URL:** `/{locale}/chat` (e.g. `/ar/chat`, `/en/chat`).
- **Nav:** “المحادثات” (ar) / “Chat” (en) via `Nav.chat`.

---

## Architecture flow

1. User opens chat → server actions load conversations/messages with Bearer from httpOnly cookie.
2. Browser connects to SignalR hub using `accessTokenFactory` → `GET /api/signalr/access-token` (same-origin, cookies) → JWT for negotiate.
3. Selecting a conversation invokes `JoinConversation`; sending uses `SendMessage` when connected, else `sendChatMessageRest`.

---

## Optional follow-ups (not in initial scope)

- Global unread badge (Redux).
- Optimistic send + hub reconciliation.
- Explicit **401** from token route → logout redirect (reuse login/session flow).
- Thread deep links: `[locale]/chat/[conversationId]/page.tsx`.
- `fr.json` / `it.json` / `ar-EG.json` `Nav` + `Chat` keys if those locales are enabled later.

---

## Verification checklist

- [ ] Set `NEXT_PUBLIC_SIGNALR_HUB_URL` in `.env` for realtime.
- [ ] Backend implements the REST paths and hub methods/events (or update `chatApi.contract.ts` + `chatService.ts`).
- [ ] CORS / IIS: WebSocket upgrade allowed for hub URL.
- [ ] Login → open `/ar/chat` or `/en/chat` → list and send receive as expected with two users.

---

*Generated as documentation for the chat feature implementation; keep in sync when you change API paths or env names.*
