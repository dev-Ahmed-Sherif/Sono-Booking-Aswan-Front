"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, MessageCircle } from "lucide-react";

import {
  openRequestChatConversation,
  getRequestChatConversations,
} from "@/actions/chat/chatService";
import {
  REQUEST_CHAT_GROUP_TYPES,
  type RequestChatGroupType,
} from "@/actions/chat/chatApi.contract";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useChatPanelOptional } from "@/contexts/chat-panel-context";
import type { ChatConversation } from "@/schemas/chat";

type RequestChatLinksProps = {
  requestId: string | null;
  locale: string;
};

const GROUP_TYPES: RequestChatGroupType[] = [
  REQUEST_CHAT_GROUP_TYPES.ownerLeader,
  REQUEST_CHAT_GROUP_TYPES.leaderReception,
  REQUEST_CHAT_GROUP_TYPES.ownerReception,
];

export function RequestChatLinks({ requestId, locale }: RequestChatLinksProps) {
  const t = useTranslations("Chat");
  const router = useRouter();
  const chatPanel = useChatPanelOptional();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [openingType, setOpeningType] = useState<string | null>(null);
  const [available, setAvailable] = useState<ChatConversation[]>([]);

  const loadAvailable = useCallback(async () => {
    if (!requestId?.trim()) {
      setAvailable([]);
      return;
    }

    setLoading(true);
    try {
      const res = await getRequestChatConversations(requestId.trim());
      if (res && "error" in res && res.error) {
        setAvailable([]);
        return;
      }
      setAvailable(res && "data" in res ? (res.data ?? []) : []);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadAvailable();
  }, [loadAvailable]);

  const openChat = async (groupType: RequestChatGroupType) => {
    if (!requestId?.trim()) return;

    setOpeningType(groupType);
    try {
      const res = await openRequestChatConversation(requestId.trim(), groupType);
      if (res && typeof res === "object" && "error" in res && res.error) {
        const errRes = res as { error: string; message?: string };
        toast({
          variant: "destructive",
          title: t("createConversationError"),
          description: errRes.message ?? errRes.error,
        });
        return;
      }

      const conversationId = res && "data" in res ? res.data?.id : undefined;
      if (!conversationId) {
        toast({
          variant: "destructive",
          title: t("createConversationError"),
        });
        return;
      }

      if (chatPanel) {
        chatPanel.openConversation(conversationId);
      } else {
        router.push(
          `/${locale}/chat?conversation=${encodeURIComponent(conversationId)}`,
        );
      }
    } finally {
      setOpeningType(null);
    }
  };

  if (!requestId?.trim()) return null;

  const availableTypes = new Set(
    available
      .map((c) => (c as ChatConversation & { groupType?: string }).groupType)
      .filter(Boolean),
  );

  const typesToShow =
    available.length > 0
      ? GROUP_TYPES.filter((type) => availableTypes.has(type))
      : GROUP_TYPES;

  if (!loading && typesToShow.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <MessageCircle className="h-4 w-4" />
        {t("requestGroupsTitle")}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {typesToShow.map((groupType) => (
            <Button
              key={groupType}
              type="button"
              variant="outline"
              size="sm"
              disabled={openingType === groupType}
              onClick={() => void openChat(groupType)}
            >
              {openingType === groupType ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              {t(`requestGroupTypes.${groupType}` as "requestGroupTypes.owner-leader")}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
