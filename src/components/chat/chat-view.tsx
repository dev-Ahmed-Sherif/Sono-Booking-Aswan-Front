"use client";

import * as React from "react";
import { useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  formatUtcToCairo,
  formatUtcToCairoShortDate,
  formatUtcToCairoTime,
  isCairoToday,
  isCairoYesterday,
  parseUtcDate,
} from "@/lib/date-timeOptions";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smile,
  Video,
} from "lucide-react";

import { ChatMessageCircleBadge } from "@/components/chat/chat-message-circle-badge";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useChatPresence } from "@/contexts/chat-presence-context";
import { useVideoCallContext } from "@/contexts/video-call-context";
import {
  getChatConversations,
  getChatContacts,
  getChatMessages,
  createChatConversation,
  sendChatMessageRest,
} from "@/actions/chat/chatService";
import {
  chatMessageSchema,
  type ChatContact,
  type ChatConversation,
  type ChatMessage,
} from "@/schemas/chat";

type ChatViewProps = {
  locale: string;
  /** Renders inside the left slide-over panel (no full-page chrome). */
  embedded?: boolean;
  /** Whether the chat panel is open (controls hub lifecycle + presence refresh). */
  panelOpen?: boolean;
  /** Opens a conversation when set (e.g. from notifications or request chat links). */
  pendingConversationId?: string | null;
  onPendingConversationHandled?: () => void;
};

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function avatarColor(seed: string): string {
  const palette = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length]!;
}

function readPayloadField(
  payload: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (key in payload && payload[key] != null) {
      return payload[key];
    }
  }
  return undefined;
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toIsoTimestamp(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value == null) {
    return undefined;
  }
  const text = String(value);
  return text || undefined;
}

function sortConversationsByUpdatedAt(
  conversations: ChatConversation[],
): ChatConversation[] {
  return [...conversations].sort((a, b) => {
    const ta = parseUtcDate(a.updatedAt)?.getTime() ?? 0;
    const tb = parseUtcDate(b.updatedAt)?.getTime() ?? 0;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}

function applyConversationPatch(
  conversations: ChatConversation[],
  conversationId: string,
  patch: Partial<ChatConversation>,
): ChatConversation[] {
  const index = conversations.findIndex((c) => c.id === conversationId);
  if (index < 0) return conversations;
  const next = [...conversations];
  const current = next[index]!;
  const merged = { ...current, id: current.id };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  next[index] = merged;
  return sortConversationsByUpdatedAt(next);
}

function upsertConversationFromUpdate(
  conversations: ChatConversation[],
  update: {
    id: string;
    lastMessagePreview?: string | null;
    updatedAt?: string | null;
    unreadCount?: number;
  },
  activeConversationId: string | null,
): ChatConversation[] {
  const existing = conversations.find((c) => c.id === update.id);
  const unreadCount =
    update.id === activeConversationId ? 0 : update.unreadCount;

  const patch: Partial<ChatConversation> = {};
  if (update.lastMessagePreview != null) {
    patch.lastMessagePreview = update.lastMessagePreview;
  }
  if (update.updatedAt != null) {
    patch.updatedAt = update.updatedAt;
  }
  if (unreadCount !== undefined) {
    patch.unreadCount = unreadCount;
  }

  if (existing) {
    return applyConversationPatch(conversations, update.id, patch);
  }

  const placeholder: ChatConversation = {
    id: update.id,
    ...patch,
  };
  return sortConversationsByUpdatedAt([placeholder, ...conversations]);
}

function normalizeConversationUpdate(payload: unknown): {
  id: string;
  lastMessagePreview?: string | null;
  updatedAt?: string | null;
  unreadCount?: number;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const idRaw = readPayloadField(o, "id", "Id");
  if (idRaw == null) return null;
  const id = String(idRaw);
  if (!id) return null;

  const previewRaw = readPayloadField(o, "lastMessagePreview", "LastMessagePreview");
  const updatedAtRaw = readPayloadField(o, "updatedAt", "UpdatedAt");
  const unreadRaw = readPayloadField(o, "unreadCount", "UnreadCount");

  return {
    id,
    lastMessagePreview:
      previewRaw != null ? String(previewRaw) : undefined,
    updatedAt: toIsoTimestamp(updatedAtRaw),
    unreadCount: coerceOptionalNumber(unreadRaw),
  };
}

function mergeMessagesById(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  for (const message of existing) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = parseUtcDate(a.createdAt)?.getTime() ?? 0;
    const tb = parseUtcDate(b.createdAt)?.getTime() ?? 0;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

function normalizeIncomingMessage(payload: unknown): ChatMessage | null {
  const parsed = chatMessageSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const conversationId = readPayloadField(o, "conversationId", "ConversationId");
    const content = readPayloadField(o, "content", "Content");
    if (conversationId == null || content == null) {
      return null;
    }
    const createdAtRaw = readPayloadField(o, "createdAt", "CreatedAt");
    return {
      id: String(readPayloadField(o, "id", "Id") ?? `msg-${Date.now()}`),
      conversationId: String(conversationId),
      senderId: String(readPayloadField(o, "senderId", "SenderId") ?? ""),
      senderName:
        readPayloadField(o, "senderName", "SenderName") != null
          ? String(readPayloadField(o, "senderName", "SenderName"))
          : null,
      content: String(content),
      createdAt:
        createdAtRaw instanceof Date
          ? createdAtRaw.toISOString()
          : createdAtRaw != null
            ? String(createdAtRaw)
            : null,
    };
  }
  return null;
}

function isSameUserId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function resolveConversationPeerId(
  conversation: ChatConversation,
  currentUserId: string,
): string | null {
  if (conversation.groupType || conversation.requestId) {
    return null;
  }
  const others = (conversation.participantUserIds ?? []).filter(
    (id) => id && !isSameUserId(id, currentUserId),
  );
  return others.length === 1 ? others[0]! : null;
}

function PresenceDot({
  isOnline,
  onlineLabel,
  offlineLabel,
}: {
  isOnline: boolean;
  onlineLabel: string;
  offlineLabel: string;
}) {
  return (
    <span
      className={cn(
        "absolute bottom-0 end-0 h-4 w-4 rounded-full border-2 border-background shadow-sm",
        isOnline
          ? "bg-emerald-500 ring-2 ring-emerald-500/30"
          : "bg-gray-400 dark:bg-gray-500",
      )}
      aria-label={isOnline ? onlineLabel : offlineLabel}
    />
  );
}

function resolveOtherParticipantId(
  conversation: ChatConversation | undefined,
  currentUserId: string,
  messages: ChatMessage[],
  contacts: ChatContact[],
): string | null {
  const participantIds = conversation?.participantUserIds ?? [];
  const fromParticipants = participantIds.filter(
    (id) => id && !isSameUserId(id, currentUserId),
  );
  if (fromParticipants.length === 1) {
    return fromParticipants[0]!;
  }

  const fromMessages = [
    ...new Set(messages.map((m) => m.senderId).filter(Boolean)),
  ].filter((id) => !isSameUserId(id, currentUserId));
  if (fromMessages.length === 1) {
    return fromMessages[0]!;
  }

  if (fromParticipants.length > 1 && fromMessages.length === 1) {
    return fromMessages[0]!;
  }

  const title = conversation?.title?.trim() ?? "";
  const participantNames = conversation?.participantNames ?? [];
  if (title || participantNames.length > 0) {
    for (const contact of contacts) {
      if (isSameUserId(contact.userId, currentUserId)) continue;
      const nameMatch =
        participantNames.some(
          (name) =>
            name.trim().toLowerCase() === contact.fullName.trim().toLowerCase(),
        ) ||
        title.toLowerCase().includes(contact.fullName.trim().toLowerCase());
      if (nameMatch) {
        return contact.userId;
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[video] Could not resolve callee", {
      participantUserIds: participantIds,
      currentUserId,
      messageSenders: fromMessages,
    });
  }

  return null;
}

function remoteDisplayNameFor(
  conversation: ChatConversation | undefined,
  remoteUserId: string,
): string {
  const ids = conversation?.participantUserIds ?? [];
  const names = conversation?.participantNames ?? [];
  const normalizedRemote = remoteUserId.trim().toLowerCase();
  const index = ids.findIndex(
    (id) => id.trim().toLowerCase() === normalizedRemote,
  );
  if (index >= 0 && names[index]) {
    return names[index]!;
  }
  return remoteUserId;
}

export function ChatView({
  locale,
  embedded = false,
  panelOpen = true,
  pendingConversationId = null,
  onPendingConversationHandled,
}: ChatViewProps) {
  const t = useTranslations("Chat");
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isRtl = locale === "ar";

  const userStorage = useLocalStorage("user");
  const reduxUserId = useSelector((state: { user?: { id?: string } }) =>
    state.user?.id ? String(state.user.id) : "",
  );
  const currentUserId = React.useMemo(() => {
    if (reduxUserId) return reduxUserId;
    const stored = userStorage.getItem() as { id?: string } | undefined;
    return stored?.id ? String(stored.id) : "";
  }, [reduxUserId, userStorage]);

  const [conversations, setConversations] = React.useState<ChatConversation[]>(
    [],
  );
  const [contacts, setContacts] = React.useState<ChatContact[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingContacts, setLoadingContacts] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sendText, setSendText] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [creatingConversation, setCreatingConversation] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [mobileShowThread, setMobileShowThread] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const refreshConversations = React.useCallback(async () => {
    setLoadingList(true);
    const res = await getChatConversations();
    setLoadingList(false);
    if ("error" in res && res.error) {
      toast({
        variant: "destructive",
        title: t("loadConversationsError"),
        description: res.message,
      });
      return;
    }
    if ("data" in res && Array.isArray(res.data)) {
      setConversations(res.data);
    }
  }, [t, toast]);

  const refreshContacts = React.useCallback(async () => {
    setLoadingContacts(true);
    const res = await getChatContacts();
    setLoadingContacts(false);
    if ("error" in res && res.error) {
      toast({
        variant: "destructive",
        title: t("loadContactsError"),
        description: res.message,
      });
      return;
    }
    if ("data" in res && Array.isArray(res.data)) {
      setContacts(res.data);
    }
  }, [t, toast]);

  React.useEffect(() => {
    refreshConversations();
    refreshContacts();
  }, [refreshConversations, refreshContacts]);

  const loadMessages = React.useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      const res = await getChatMessages(conversationId, { take: 100 });
      setLoadingMessages(false);
      if (selectedIdRef.current !== conversationId) {
        return;
      }
      if ("error" in res && res.error) {
        toast({
          variant: "destructive",
          title: t("loadMessagesError"),
          description: res.message,
        });
        setMessages([]);
        return;
      }
      if ("data" in res && Array.isArray(res.data)) {
        const fromApi = res.data;
        setMessages((prev) =>
          mergeMessagesById(
            prev.filter((m) => m.conversationId === conversationId),
            fromApi,
          ),
        );
      }
    },
    [t, toast],
  );

  React.useEffect(() => {
    const fromUrl = searchParams.get("conversation");
    if (fromUrl) {
      setSelectedId(fromUrl);
      setMobileShowThread(true);
      loadMessages(fromUrl);
    }
  }, [searchParams, loadMessages]);

  React.useEffect(() => {
    if (!pendingConversationId) return;
    setSelectedId(pendingConversationId);
    setMobileShowThread(true);
    void loadMessages(pendingConversationId);
    onPendingConversationHandled?.();
  }, [
    pendingConversationId,
    loadMessages,
    onPendingConversationHandled,
  ]);

  const refreshConversationsRef = React.useRef(refreshConversations);
  refreshConversationsRef.current = refreshConversations;

  const patchConversationList = React.useCallback(
    (
      conversationId: string,
      patch: Partial<ChatConversation>,
      options?: { refreshIfMissing?: boolean },
    ) => {
      setConversations((prev) => {
        if (!prev.some((c) => c.id === conversationId)) {
          if (options?.refreshIfMissing) {
            void refreshConversationsRef.current();
          }
          return prev;
        }
        return applyConversationPatch(prev, conversationId, patch);
      });
    },
    [],
  );

  const onReceiveMessage = React.useCallback((payload: unknown) => {
    const msg = normalizeIncomingMessage(payload);
    if (!msg) return;
    const activeConversationId = selectedIdRef.current;
    const isActiveConversation = msg.conversationId === activeConversationId;
    const isOwnMessage =
      Boolean(currentUserId) && msg.senderId === currentUserId;

    if (isActiveConversation) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const withoutPending = prev.filter(
          (m) =>
            !(
              m.id.startsWith("pending-") &&
              m.senderId === msg.senderId &&
              m.content === msg.content
            ),
        );
        return [...withoutPending, msg];
      });
    }

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === msg.conversationId);
      if (!existing) {
        void refreshConversationsRef.current();
        return prev;
      }
      const patch: Partial<ChatConversation> = {
        lastMessagePreview: msg.content.slice(0, 120),
        updatedAt: msg.createdAt ?? new Date().toISOString(),
      };
      if (isActiveConversation && !isOwnMessage) {
        patch.unreadCount = 0;
      }
      return applyConversationPatch(prev, msg.conversationId, patch);
    });
  }, [currentUserId]);

  const onConversationUpdated = React.useCallback((payload: unknown) => {
    const update = normalizeConversationUpdate(payload);
    if (!update) return;

    const activeConversationId = selectedIdRef.current;
    let wasMissing = false;

    setConversations((prev) => {
      wasMissing = !prev.some((c) => c.id === update.id);
      return upsertConversationFromUpdate(
        prev,
        update,
        activeConversationId,
      );
    });

    if (wasMissing) {
      void refreshConversationsRef.current();
    }
  }, []);

  const directPeerIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const conversation of conversations) {
      const peerId = resolveConversationPeerId(conversation, currentUserId);
      if (peerId) {
        ids.add(peerId);
      }
    }
    return ids;
  }, [conversations, currentUserId]);

  const watchedUserIds = React.useMemo(() => {
    const ids = new Set<string>(directPeerIds);
    for (const contact of contacts) {
      if (contact.userId && !isSameUserId(contact.userId, currentUserId)) {
        ids.add(contact.userId);
      }
    }
    return Array.from(ids);
  }, [contacts, currentUserId, directPeerIds]);

  const {
    hubConfigured,
    isConnected,
    connectionError,
    isUserOnline,
    setWatchUserIds,
    subscribeToMessages,
    subscribeToConversationUpdates,
    setActiveConversation,
    sendViaHub,
  } = useChatPresence();

  React.useEffect(() => {
    setWatchUserIds(watchedUserIds);
  }, [watchedUserIds, setWatchUserIds]);

  React.useEffect(() => {
    if (!panelOpen) {
      return undefined;
    }
    return subscribeToMessages(onReceiveMessage);
  }, [panelOpen, onReceiveMessage, subscribeToMessages]);

  React.useEffect(() => {
    if (!panelOpen) {
      return undefined;
    }
    return subscribeToConversationUpdates(onConversationUpdated);
  }, [panelOpen, onConversationUpdated, subscribeToConversationUpdates]);

  const {
    hubConfigured: videoHubConfigured,
    openOverlay: openVideoOverlay,
  } = useVideoCallContext();

  React.useEffect(() => {
    void setActiveConversation(panelOpen ? selectedId : null);
  }, [panelOpen, selectedId, setActiveConversation, isConnected]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setMobileShowThread(true);
    setMessages((prev) => prev.filter((m) => m.conversationId === id));
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
    loadMessages(id);
  };

  const handleSend = async () => {
    if (!selectedId || !sendText.trim() || sending) return;
    setSending(true);
    const text = sendText.trim();
    setSendText("");
    const pendingId = `pending-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: pendingId,
      conversationId: selectedId,
      senderId: currentUserId,
      senderName: null,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    patchConversationList(selectedId, {
      lastMessagePreview: text.slice(0, 120),
      updatedAt: optimisticMessage.createdAt,
      unreadCount: 0,
    });

    const appendServerMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== pendingId);
        if (withoutPending.some((m) => m.id === msg.id)) return withoutPending;
        return [...withoutPending, msg];
      });
    };

    try {
      let sentViaHub = false;
      if (isConnected && hubConfigured) {
        try {
          await sendViaHub(selectedId, text);
          sentViaHub = true;
        } catch {
          sentViaHub = false;
        }
      }

      if (!sentViaHub) {
        const res = await sendChatMessageRest(selectedId, text);
        if ("error" in res && res.error) {
          throw new Error(res.message);
        }
        if ("data" in res && res.data) {
          appendServerMessage(res.data);
        }
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setSendText(text);
      toast({
        variant: "destructive",
        title: t("sendError"),
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async (participantUserIds: string[]) => {
    if (!participantUserIds.length || creatingConversation) return;
    setCreatingConversation(true);
    const res = await createChatConversation(participantUserIds);
    setCreatingConversation(false);
    if ("error" in res && res.error) {
      toast({
        variant: "destructive",
        title: t("createConversationError"),
        description: res.message,
      });
      return;
    }
    if ("data" in res && res.data) {
      const conv = res.data as ChatConversation;
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      selectConversation(conv.id);
      toast({ description: t("conversationCreated") });
    }
  };

  const handleStartConversationWithContact = (contact: ChatContact) => {
    void handleCreateConversation([contact.userId]);
  };

  const formatListTime = (value?: string | null) => {
    if (!value) return "";
    if (isCairoToday(value)) return formatUtcToCairoTime(value);
    if (isCairoYesterday(value)) return isRtl ? "أمس" : "Yesterday";
    return formatUtcToCairoShortDate(value);
  };

  const formatMessageTime = (value?: string | null) => {
    if (!value) return "";
    return formatUtcToCairoTime(value);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (c.title || c.participantNames?.join(" ") || "").toLowerCase();
    const preview = (c.lastMessagePreview || "").toLowerCase();
    return title.includes(q) || preview.includes(q);
  });

  const startableContacts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (directPeerIds.has(contact.userId)) return false;
      if (!q) return true;
      return (
        contact.fullName.toLowerCase().includes(q) ||
        contact.role.toLowerCase().includes(q)
      );
    });
  }, [contacts, directPeerIds, searchQuery]);

  const selected = conversations.find((c) => c.id === selectedId);
  const threadMessages = React.useMemo(
    () =>
      selectedId
        ? messages.filter((m) => m.conversationId === selectedId)
        : [],
    [messages, selectedId],
  );

  React.useEffect(() => {
    scrollToBottom();
  }, [threadMessages.length, selectedId]);

  const selectedTitle =
    selected?.title ||
    selected?.participantNames?.join(", ") ||
    t("unnamedConversation");

  const otherParticipantId = resolveOtherParticipantId(
    selected,
    currentUserId,
    threadMessages,
    contacts,
  );

  const openVideoCall = () => {
    if (!videoHubConfigured) {
      toast({
        variant: "destructive",
        description: t("videoCall.hubMissing"),
      });
      return;
    }
    if (!otherParticipantId) {
      toast({
        variant: "destructive",
        description: t("videoCall.noCallee"),
      });
      return;
    }
    openVideoOverlay({
      calleeId: otherParticipantId,
      remoteDisplayName: remoteDisplayNameFor(selected, otherParticipantId),
    });
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded
          ? "h-full bg-background"
          : "h-[calc(100vh-5rem)] min-h-[32rem] bg-muted/30",
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className={cn(
          "flex h-full w-full flex-1 overflow-hidden bg-background/80 backdrop-blur-sm",
          embedded
            ? "min-h-0"
            : "mx-auto max-w-6xl rounded-2xl border border-border/60 shadow-xl",
        )}
      >
        {/* Conversation list */}
        <aside
          className={cn(
            "flex w-full flex-col border-e border-border/40 bg-background md:w-[340px] lg:w-[360px]",
            mobileShowThread && "hidden md:flex",
          )}
        >
          <div className="border-b border-border bg-background px-4 py-5 text-foreground shadow-sm">
            <h1 className="text-lg font-bold tracking-tight">{t("conversations")}</h1>
            <div className="relative mt-4">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchConversations")}
                className="h-10 rounded-xl border border-input bg-background ps-9 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {loadingList || loadingContacts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 &&
              startableContacts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t("emptyConversations")}
              </p>
            ) : (
              <ul>
                {startableContacts.length > 0 && (
                  <li className="px-2 py-2">
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400/80">
                      {t("availableContacts")}
                    </p>
                  </li>
                )}
                {startableContacts.map((contact) => (
                  <li key={`contact-${contact.userId}`}>
                    <button
                      type="button"
                      disabled={creatingConversation}
                      onClick={() => handleStartConversationWithContact(contact)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-all hover:bg-emerald-50/80 hover:shadow-sm disabled:opacity-60 dark:hover:bg-emerald-950/20"
                    >
                      <span className="relative shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold text-white",
                              avatarColor(contact.userId),
                            )}
                          >
                            {initialsFromName(contact.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceDot
                          isOnline={isUserOnline(contact.userId)}
                          onlineLabel={t("partnerOnline")}
                          offlineLabel={t("partnerOffline")}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {contact.fullName}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 rounded-full bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          >
                            {t("startChat")}
                          </Badge>
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {t(`roles.${contact.role}`, {
                            defaultValue: contact.role,
                          })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {filteredConversations.map((c) => {
                  const title =
                    c.title ||
                    c.participantNames?.join(", ") ||
                    t("unnamedConversation");
                  const active = selectedId === c.id;
                  const unread = (c.unreadCount ?? 0) > 0;
                  const peerUserId = resolveConversationPeerId(c, currentUserId);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(c.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-all hover:bg-white hover:shadow-sm dark:hover:bg-muted/40",
                          active &&
                            "bg-white shadow-md ring-1 ring-emerald-200/80 dark:bg-muted/50 dark:ring-emerald-800/50",
                        )}
                      >
                        <span className="relative shrink-0">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback
                              className={cn(
                                "text-sm font-semibold text-white",
                                avatarColor(c.id),
                              )}
                            >
                              {initialsFromName(title)}
                            </AvatarFallback>
                          </Avatar>
                          {peerUserId && (
                            <PresenceDot
                              isOnline={isUserOnline(peerUserId)}
                              onlineLabel={t("partnerOnline")}
                              offlineLabel={t("partnerOffline")}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                unread ? "font-bold" : "font-medium",
                              )}
                            >
                              {title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatListTime(c.updatedAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {c.lastMessagePreview || t("emptyMessages")}
                            </span>
                            {unread && (
                              <Badge className="h-5 min-w-5 justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-1.5 text-[10px] shadow-sm">
                                {c.unreadCount}
                              </Badge>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Active thread */}
        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col bg-gradient-to-br from-stone-100 via-[#efeae2] to-emerald-50/40 dark:from-background dark:via-background dark:to-emerald-950/10",
            !mobileShowThread && "hidden md:flex",
          )}
        >
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <ChatMessageCircleBadge />
              <h2 className="text-xl font-bold tracking-tight">{t("title")}</h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t("selectConversationHint")}
              </p>
              {!hubConfigured && (
                <p className="text-xs text-amber-600">{t("hubMissing")}</p>
              )}
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border bg-background px-3 py-3 text-foreground shadow-sm md:px-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileShowThread(false)}
                  aria-label={t("backToList")}
                >
                  <ArrowLeft className={cn("h-5 w-5", isRtl && "rotate-180")} />
                </Button>
                <span className="relative shrink-0">
                  <Avatar className="h-10 w-10 border-2 border-border">
                    <AvatarFallback
                      className={cn(
                        "text-sm font-semibold text-white",
                        avatarColor(selectedId),
                      )}
                    >
                      {initialsFromName(selectedTitle)}
                    </AvatarFallback>
                  </Avatar>
                  {otherParticipantId && (
                    <PresenceDot
                      isOnline={isUserOnline(otherParticipantId)}
                      onlineLabel={t("partnerOnline")}
                      offlineLabel={t("partnerOffline")}
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selectedTitle}</p>
                  <p
                    className="text-xs text-muted-foreground"
                    title={connectionError ?? undefined}
                  >
                    {otherParticipantId
                      ? isUserOnline(otherParticipantId)
                        ? t("online")
                        : t("offline")
                      : isConnected
                        ? t("online")
                        : connectionError
                          ? t("realtimeError", { error: connectionError })
                          : t("realtimeOff")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("videoCall.startVideoCall")}
                  disabled={!selectedId || !otherParticipantId || !videoHubConfigured}
                  onClick={() => openVideoCall()}
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-hidden
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </header>

              <div
                className="flex-1 overflow-y-auto px-3 py-4 md:px-6"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(16,185,129,0.06) 1px, transparent 0)",
                  backgroundSize: "20px 20px",
                }}
              >
                {loadingMessages && threadMessages.length === 0 ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : threadMessages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t("emptyMessages")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {threadMessages.map((m, idx) => {
                      const mine =
                        currentUserId && m.senderId === currentUserId;
                      const isLastMine =
                        mine &&
                        !threadMessages
                          .slice(idx + 1)
                          .some((x) => x.senderId === currentUserId);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex w-full",
                            mine ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "relative max-w-[min(85%,28rem)] px-3.5 py-2.5 text-sm shadow-md",
                              mine
                                ? "rounded-2xl rounded-ee-sm bg-gradient-to-br from-emerald-100 to-teal-50 text-foreground ring-1 ring-emerald-200/60 dark:from-emerald-900/50 dark:to-teal-900/30 dark:ring-emerald-800/40"
                                : "rounded-2xl rounded-es-sm bg-white text-foreground ring-1 ring-black/5 dark:bg-muted dark:ring-white/10",
                            )}
                          >
                            {!mine && m.senderName && (
                              <p className="mb-0.5 text-xs font-semibold text-emerald-700">
                                {m.senderName}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words">
                              {m.content}
                            </p>
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1 text-[10px] text-muted-foreground",
                                mine ? "justify-end" : "justify-start",
                              )}
                            >
                              <span>{formatMessageTime(m.createdAt)}</span>
                              {mine && isLastMine && (
                                <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
                              )}
                              {mine && !isLastMine && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <footer className="border-t border-border/50 bg-white/85 px-3 py-3 backdrop-blur-md dark:bg-muted/40 md:px-4">
                <div className="flex items-end gap-2 rounded-2xl bg-slate-50/90 p-1.5 ring-1 ring-border/40 dark:bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    disabled
                    aria-hidden
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    disabled
                    aria-hidden
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder={t("messagePlaceholder")}
                    value={sendText}
                    disabled={sending}
                    onChange={(e) => setSendText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1 rounded-xl border-0 bg-white text-sm shadow-sm ring-1 ring-border/30 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-background"
                  />
                  <Button
                    type="button"
                    size="icon"
                    disabled={sending || !sendText.trim()}
                    onClick={handleSend}
                    className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md transition-transform hover:scale-105 hover:from-emerald-600 hover:to-teal-700 active:scale-95"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send
                        className={cn("h-4 w-4", isRtl && "scale-x-[-1]")}
                      />
                    )}
                  </Button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
