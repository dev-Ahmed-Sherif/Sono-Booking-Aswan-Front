"use client";

import { ChatPanelProvider } from "@/contexts/chat-panel-context";
import { ChatPresenceProvider } from "@/contexts/chat-presence-context";
import { VideoCallProvider } from "@/contexts/video-call-context";
import { AppChatPanel } from "@/components/chat/app-chat-panel";

type AuthenticatedAppShellProps = {
  authenticated: boolean;
  locale: string;
  children: React.ReactNode;
};

export function AuthenticatedAppShell({
  authenticated,
  locale,
  children,
}: AuthenticatedAppShellProps) {
  if (!authenticated) {
    return <>{children}</>;
  }

  return (
    <VideoCallProvider>
      <ChatPresenceProvider>
        <ChatPanelProvider>
          {children}
          <AppChatPanel locale={locale} />
        </ChatPanelProvider>
      </ChatPresenceProvider>
    </VideoCallProvider>
  );
}
