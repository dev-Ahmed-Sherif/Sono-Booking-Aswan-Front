"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useChatPanel } from "@/contexts/chat-panel-context";

function ChatPageRedirect({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setOpen, openConversation } = useChatPanel();

  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (conversationId) {
      openConversation(conversationId);
    } else {
      setOpen(true);
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(`/${locale}/reservation`);
    // Open panel once when landing on legacy /chat URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ChatPageClient({ locale }: { locale: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ChatPageRedirect locale={locale} />
    </Suspense>
  );
}
