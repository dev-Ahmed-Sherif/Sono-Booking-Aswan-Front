"use client";

import * as signalR from "@microsoft/signalr";
import {
  CHAT_HUB_EVENTS,
  type UserPresenceChangedPayload,
} from "@/actions/chat/chatApi.contract";
import {
  applySignalRTimeouts,
  buildSignalRHttpOptions,
} from "@/lib/signalr/connection-options";

export type ChatHubHandlers = {
  onReceiveMessage: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
  onUserPresenceChanged?: (payload: UserPresenceChangedPayload) => void;
};

export function buildChatHubConnection(
  hubUrl: string,
  handlers: ChatHubHandlers,
): signalR.HubConnection {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, buildSignalRHttpOptions(hubUrl))
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  applySignalRTimeouts(connection);

  connection.on(CHAT_HUB_EVENTS.receiveMessage, (payload: unknown) => {
    handlers.onReceiveMessage(payload);
  });

  if (handlers.onConversationUpdated) {
    connection.on(
      CHAT_HUB_EVENTS.conversationUpdated,
      (payload: unknown) => {
        handlers.onConversationUpdated?.(payload);
      },
    );
  }

  if (handlers.onUserPresenceChanged) {
    connection.on(
      CHAT_HUB_EVENTS.userPresenceChanged,
      (arg1: unknown, arg2?: unknown) => {
        handlers.onUserPresenceChanged?.(normalizePresencePayload(arg1, arg2));
      },
    );
  }

  return connection;
}

function normalizePresencePayload(
  arg1: unknown,
  arg2?: unknown,
): UserPresenceChangedPayload {
  if (typeof arg1 === "string" && typeof arg2 === "boolean") {
    return { userId: arg1, isOnline: arg2 };
  }

  if (arg1 && typeof arg1 === "object") {
    const o = arg1 as Record<string, unknown>;
    const userIdRaw = o.userId ?? o.UserId;
    const isOnlineRaw = o.isOnline ?? o.IsOnline;
    if (userIdRaw != null) {
      return {
        userId: String(userIdRaw),
        isOnline: Boolean(isOnlineRaw),
      };
    }
  }

  return { userId: "", isOnline: false };
}
