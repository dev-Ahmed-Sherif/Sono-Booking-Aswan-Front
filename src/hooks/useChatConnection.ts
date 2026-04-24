"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { CHAT_HUB_METHODS } from "@/actions/chat/chatApi.contract";
import { getSignalRHubUrl } from "@/lib/chat-env";
import { buildChatHubConnection } from "@/lib/signalr/chat-hub";

export type UseChatConnectionOptions = {
  enabled: boolean;
  onReceiveMessage: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
};

export function useChatConnection({
  enabled,
  onReceiveMessage,
  onConversationUpdated,
}: UseChatConnectionOptions) {
  const hubUrl = getSignalRHubUrl();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const joinedIdRef = useRef<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(signalR.HubConnectionState.Disconnected);

  const onMessageRef = useRef(onReceiveMessage);
  const onConvRef = useRef(onConversationUpdated);
  onMessageRef.current = onReceiveMessage;
  onConvRef.current = onConversationUpdated;

  useEffect(() => {
    if (!enabled || !hubUrl) {
      return undefined;
    }

    const connection = buildChatHubConnection(hubUrl, {
      onReceiveMessage: (p) => onMessageRef.current(p),
      onConversationUpdated: (p) => onConvRef.current?.(p),
    });

    connectionRef.current = connection;

    const updateState = () => setConnectionState(connection.state);
    connection.onclose(updateState);
    connection.onreconnecting(updateState);
    connection.onreconnected(updateState);

    connection
      .start()
      .then(updateState)
      .catch(() => {
        updateState();
      });

    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        connection.state === signalR.HubConnectionState.Disconnected
      ) {
        connection.start().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      joinedIdRef.current = null;
      connection
        .stop()
        .catch(() => {})
        .finally(() => {
          connectionRef.current = null;
          setConnectionState(signalR.HubConnectionState.Disconnected);
        });
    };
  }, [enabled, hubUrl]);

  const setActiveConversation = useCallback(
    async (conversationId: string | null) => {
      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      if (joinedIdRef.current) {
        try {
          await conn.invoke(
            CHAT_HUB_METHODS.leaveConversation,
            joinedIdRef.current,
          );
        } catch {
          /* ignore */
        }
        joinedIdRef.current = null;
      }

      if (conversationId) {
        try {
          await conn.invoke(
            CHAT_HUB_METHODS.joinConversation,
            conversationId,
          );
          joinedIdRef.current = conversationId;
        } catch {
          joinedIdRef.current = null;
        }
      }
    },
    [],
  );

  const sendViaHub = useCallback(
    async (conversationId: string, content: string) => {
      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
        throw new Error("SignalR not connected");
      }
      await conn.invoke(
        CHAT_HUB_METHODS.sendMessage,
        conversationId,
        content.trim(),
      );
    },
    [],
  );

  return {
    hubConfigured: Boolean(hubUrl),
    connectionState,
    isConnected: connectionState === signalR.HubConnectionState.Connected,
    setActiveConversation,
    sendViaHub,
  };
}
