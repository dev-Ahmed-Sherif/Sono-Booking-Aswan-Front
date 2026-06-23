"use client";

import * as React from "react";

type ChatPanelContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openConversation: (conversationId: string) => void;
  pendingConversationId: string | null;
  clearPendingConversation: () => void;
};

const ChatPanelContext = React.createContext<ChatPanelContextValue | null>(
  null,
);

export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [pendingConversationId, setPendingConversationId] = React.useState<
    string | null
  >(null);

  const openConversation = React.useCallback((conversationId: string) => {
    setPendingConversationId(conversationId);
    setOpen(true);
  }, []);

  const clearPendingConversation = React.useCallback(() => {
    setPendingConversationId(null);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      openConversation,
      pendingConversationId,
      clearPendingConversation,
    }),
    [
      open,
      openConversation,
      pendingConversationId,
      clearPendingConversation,
    ],
  );

  return (
    <ChatPanelContext.Provider value={value}>
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel(): ChatPanelContextValue {
  const ctx = React.useContext(ChatPanelContext);
  if (!ctx) {
    throw new Error("useChatPanel must be used within ChatPanelProvider");
  }
  return ctx;
}

/** Safe when chat panel may be unavailable (e.g. unauthenticated). */
export function useChatPanelOptional(): ChatPanelContextValue | null {
  return React.useContext(ChatPanelContext);
}
