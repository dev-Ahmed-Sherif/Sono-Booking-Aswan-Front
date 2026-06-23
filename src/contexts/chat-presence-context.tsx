"use client";

import * as React from "react";

import { useChatConnection } from "@/hooks/useChatConnection";

type MessageHandler = (payload: unknown) => void;

export type ChatPresenceContextValue = {
  hubConfigured: boolean;
  isConnected: boolean;
  connectionError: string | null;
  isUserOnline: (userId: string) => boolean;
  refreshOnlineStatuses: () => Promise<void>;
  setWatchUserIds: (userIds: string[]) => void;
  subscribeToMessages: (handler: MessageHandler) => () => void;
  subscribeToConversationUpdates: (handler: MessageHandler) => () => void;
  setActiveConversation: (conversationId: string | null) => Promise<void>;
  sendViaHub: (conversationId: string, content: string) => Promise<void>;
};

const ChatPresenceContext = React.createContext<ChatPresenceContextValue | null>(
  null,
);

const PRESENCE_REFRESH_INTERVAL_MS = 60_000;

export function ChatPresenceProvider({ children }: { children: React.ReactNode }) {
  const [watchUserIds, setWatchUserIds] = React.useState<string[]>([]);
  const messageHandlersRef = React.useRef(new Set<MessageHandler>());
  const conversationHandlersRef = React.useRef(new Set<MessageHandler>());

  const onReceiveMessage = React.useCallback((payload: unknown) => {
    for (const handler of messageHandlersRef.current) {
      handler(payload);
    }
  }, []);

  const onConversationUpdated = React.useCallback((payload: unknown) => {
    for (const handler of conversationHandlersRef.current) {
      handler(payload);
    }
  }, []);

  const {
    hubConfigured,
    isConnected,
    connectionError,
    isUserOnline,
    refreshOnlineStatuses,
    setActiveConversation,
    sendViaHub,
  } = useChatConnection({
    enabled: true,
    panelOpen: true,
    watchUserIds,
    onReceiveMessage,
    onConversationUpdated,
  });

  const subscribeToMessages = React.useCallback((handler: MessageHandler) => {
    messageHandlersRef.current.add(handler);
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  const subscribeToConversationUpdates = React.useCallback(
    (handler: MessageHandler) => {
      conversationHandlersRef.current.add(handler);
      return () => {
        conversationHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshOnlineStatuses();
    }, PRESENCE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshOnlineStatuses]);

  const value = React.useMemo<ChatPresenceContextValue>(
    () => ({
      hubConfigured,
      isConnected,
      connectionError,
      isUserOnline,
      refreshOnlineStatuses,
      setWatchUserIds,
      subscribeToMessages,
      subscribeToConversationUpdates,
      setActiveConversation,
      sendViaHub,
    }),
    [
      hubConfigured,
      isConnected,
      connectionError,
      isUserOnline,
      refreshOnlineStatuses,
      subscribeToMessages,
      subscribeToConversationUpdates,
      setActiveConversation,
      sendViaHub,
    ],
  );

  return (
    <ChatPresenceContext.Provider value={value}>
      {children}
    </ChatPresenceContext.Provider>
  );
}

export function useChatPresence(): ChatPresenceContextValue {
  const context = React.useContext(ChatPresenceContext);
  if (!context) {
    throw new Error("useChatPresence must be used within ChatPresenceProvider");
  }
  return context;
}
