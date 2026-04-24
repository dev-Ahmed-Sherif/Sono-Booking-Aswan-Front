"use client";

import * as signalR from "@microsoft/signalr";
import {
  CHAT_HUB_EVENTS,
} from "@/actions/chat/chatApi.contract";

async function fetchAccessToken(): Promise<string> {
  const res = await fetch("/api/signalr/access-token", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error("No access token in response");
  }
  return body.accessToken;
}

export type ChatHubHandlers = {
  onReceiveMessage: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
};

export function buildChatHubConnection(
  hubUrl: string,
  handlers: ChatHubHandlers,
): signalR.HubConnection {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: fetchAccessToken,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .build();

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

  return connection;
}
