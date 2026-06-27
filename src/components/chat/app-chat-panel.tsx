"use client";

import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/utils";
import { useChatPanel } from "@/contexts/chat-panel-context";
import { ChatView } from "@/components/chat/chat-view";
import { ChatMessageCircleBadge } from "@/components/chat/chat-message-circle-badge";

type AppChatPanelProps = {
  locale: string;
};

export function ChatPanelToggleButton() {
  const t = useTranslations("Nav");
  const { setOpen } = useChatPanel();

  return (
    <div className="fixed left-3 z-[9999] bottom-[6.25rem] size-20 sm:left-4 lg:bottom-[4.75rem]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-primary/25 animate-chat-fab-ring"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 blur-md"
      />
      <button
        type="button"
        className={cn(
          "relative rounded-full border-0 bg-transparent p-0",
          "transition-all duration-300 hover:scale-110 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        )}
        onClick={() => setOpen(true)}
        aria-label={t("chat")}
      >
        <ChatMessageCircleBadge
          className="h-20 w-20"
          iconClassName="animate-chat-icon-float h-9 w-9"
        />
        <span className="sr-only">{t("chat")}</span>
      </button>
    </div>
  );
}

export function AppChatPanel({ locale }: AppChatPanelProps) {
  const t = useTranslations("Nav");
  const { open, setOpen, pendingConversationId, clearPendingConversation } =
    useChatPanel();

  return (
    <>
      <ChatPanelToggleButton />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          forceMount
          side="left"
          className="flex h-full w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden border-r border-border p-0 shadow-2xl lg:w-[min(96vw,56rem)] lg:max-w-none"
        >
          <VisuallyHidden>
            <SheetTitle>{t("chat")}</SheetTitle>
            <SheetDescription>{t("chat")}</SheetDescription>
          </VisuallyHidden>
          <ChatView
            locale={locale}
            embedded
            panelOpen={open}
            pendingConversationId={pendingConversationId}
            onPendingConversationHandled={clearPendingConversation}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
