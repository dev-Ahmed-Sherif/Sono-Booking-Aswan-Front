"use client";

import * as React from "react";
import { useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Loader2, MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useChatConnection } from "@/hooks/useChatConnection";
import {
  getChatConversations,
  getChatMessages,
  createChatConversation,
  sendChatMessageRest,
} from "@/actions/chat/chatService";
import {
  chatMessageSchema,
  type ChatConversation,
  type ChatMessage,
} from "@/schemas/chat";

type ChatViewProps = {
  locale: string;
};

function normalizeIncomingMessage(payload: unknown): ChatMessage | null {
  const parsed = chatMessageSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  if (
    payload &&
    typeof payload === "object" &&
    "conversationId" in payload &&
    "content" in payload
  ) {
    const o = payload as Record<string, unknown>;
    return {
      id: String(o.id ?? `msg-${Date.now()}`),
      conversationId: String(o.conversationId),
      senderId: String(o.senderId ?? ""),
      senderName: o.senderName != null ? String(o.senderName) : null,
      content: String(o.content ?? ""),
      createdAt: o.createdAt != null ? String(o.createdAt) : null,
    };
  }
  return null;
}

export function ChatView({ locale }: ChatViewProps) {
  const t = useTranslations("Chat");
  const { toast } = useToast();
  const currentUserId = useSelector((state: { user?: { id?: string } }) =>
    state.user?.id ? String(state.user.id) : "",
  );

  const [conversations, setConversations] = React.useState<ChatConversation[]>(
    [],
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sendText, setSendText] = React.useState("");
  const [participantInput, setParticipantInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const dateLocale = locale === "ar" ? ar : enUS;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, selectedId]);

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

  React.useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const loadMessages = React.useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      const res = await getChatMessages(conversationId, { take: 100 });
      setLoadingMessages(false);
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
        setMessages(res.data);
      }
    },
    [t, toast],
  );

  const onReceiveMessage = React.useCallback(
    (payload: unknown) => {
      const msg = normalizeIncomingMessage(payload);
      if (!msg) return;
      setMessages((prev) => {
        if (msg.conversationId !== selectedId) return prev;
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessagePreview: msg.content.slice(0, 120),
                updatedAt: msg.createdAt ?? c.updatedAt,
              }
            : c,
        ),
      );
    },
    [selectedId],
  );

  const { hubConfigured, isConnected, setActiveConversation, sendViaHub } =
    useChatConnection({
      enabled: true,
      onReceiveMessage,
    });

  React.useEffect(() => {
    setActiveConversation(selectedId);
  }, [selectedId, setActiveConversation]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    loadMessages(id);
  };

  const handleSend = async () => {
    if (!selectedId || !sendText.trim() || sending) return;
    setSending(true);
    const text = sendText.trim();
    setSendText("");
    try {
      if (isConnected) {
        await sendViaHub(selectedId, text);
      } else {
        const res = await sendChatMessageRest(selectedId, text);
        if ("error" in res && res.error) {
          throw new Error(res.message);
        }
        if ("data" in res && res.data) {
          const msg = res.data;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        }
      }
    } catch (e) {
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

  const handleCreateConversation = async () => {
    const raw = participantInput.trim();
    if (!raw) {
      toast({
        variant: "destructive",
        description: t("participantRequired"),
      });
      return;
    }
    const ids = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await createChatConversation(ids);
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
      setParticipantInput("");
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      selectConversation(conv.id);
      toast({ description: t("conversationCreated") });
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="container max-w-6xl py-6 px-4 flex flex-col gap-4 min-h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-primary" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        {!hubConfigured && (
          <p className="text-amber-600 dark:text-amber-400 text-sm">
            {t("hubMissing")}
          </p>
        )}
        {hubConfigured && (
          <p className="text-muted-foreground text-xs">
            {isConnected ? t("realtimeOn") : t("realtimeOff")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-4 flex flex-col min-h-[280px] lg:min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("conversations")}</CardTitle>
            <div className="flex gap-2 pt-2">
              <Input
                placeholder={t("participantPlaceholder")}
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCreateConversation}
              >
                {t("newChat")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0">
            {loadingList ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("emptyConversations")}
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "w-full text-start rounded-lg px-3 py-2 text-sm transition-colors",
                        selectedId === c.id
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <div className="font-medium line-clamp-1">
                        {c.title ||
                          c.participantNames?.join(", ") ||
                          t("unnamedConversation")}
                      </div>
                      {c.lastMessagePreview && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {c.lastMessagePreview}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 flex flex-col min-h-[400px] lg:min-h-0">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-lg">
              {selected
                ? selected.title ||
                  selected.participantNames?.join(", ") ||
                  t("thread")
                : t("selectConversation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 p-4 min-h-0">
            {!selectedId ? (
              <p className="text-muted-foreground text-sm m-auto text-center px-4">
                {t("selectConversationHint")}
              </p>
            ) : loadingMessages ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                className="flex-1 overflow-y-auto space-y-3 pe-1"
                dir={locale === "ar" ? "rtl" : "ltr"}
              >
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    {t("emptyMessages")}
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine =
                      currentUserId && m.senderId === currentUserId;
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
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md",
                          )}
                        >
                          {!mine && m.senderName && (
                            <div className="text-xs font-semibold opacity-80 mb-0.5">
                              {m.senderName}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap break-words">
                            {m.content}
                          </p>
                          {m.createdAt &&
                            !Number.isNaN(new Date(m.createdAt).getTime()) && (
                            <div
                              className={cn(
                                "text-[10px] mt-1 opacity-70",
                                mine ? "text-end" : "text-start",
                              )}
                            >
                              {format(new Date(m.createdAt), "PPp", {
                                locale: dateLocale,
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder={t("messagePlaceholder")}
                value={sendText}
                disabled={!selectedId || sending}
                onChange={(e) => setSendText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                disabled={!selectedId || sending || !sendText.trim()}
                onClick={handleSend}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
