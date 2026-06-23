"use client";

import * as React from "react";

import { VideoCallOverlay } from "@/components/chat/video-call-overlay";
import { getChatContacts } from "@/actions/chat/chatService";
import { useVideoCall } from "@/hooks/useVideoCall";
import { playPhoneRing, stopPhoneRing } from "@/lib/phone-ring-sound";
import type { ChatContact } from "@/schemas/chat";

type OpenOverlayOptions = {
  calleeId?: string;
  remoteDisplayName?: string;
};

export type VideoCallContextValue = ReturnType<typeof useVideoCall> & {
  overlayOpen: boolean;
  openOverlay: (options?: OpenOverlayOptions) => void;
  closeOverlay: () => void;
  remoteDisplayName: string | undefined;
};

const VideoCallContext = React.createContext<VideoCallContextValue | null>(null);

function resolveContactName(
  contacts: ChatContact[],
  userId: string,
): string | undefined {
  const normalized = userId.trim().toLowerCase();
  const match = contacts.find(
    (c) => c.userId.trim().toLowerCase() === normalized,
  );
  return match?.fullName;
}

function VideoCallProviderInner({ children }: { children: React.ReactNode }) {
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [displayNameHint, setDisplayNameHint] = React.useState<
    string | undefined
  >();
  const [contacts, setContacts] = React.useState<ChatContact[]>([]);

  const refreshContacts = React.useCallback(async () => {
    const res = await getChatContacts();
    if ("data" in res && Array.isArray(res.data)) {
      setContacts(res.data);
    }
  }, []);

  React.useEffect(() => {
    void refreshContacts();
  }, [refreshContacts]);

  const videoCall = useVideoCall({
    enabled: true,
    onIncomingCall: () => {
      playPhoneRing();
      setOverlayOpen(true);
      void refreshContacts();
    },
    onCallEnded: () => {
      stopPhoneRing();
      setOverlayOpen(false);
      setDisplayNameHint(undefined);
    },
  });

  const { remoteUserId, hubConfigured, setCallRemoteUserId } = videoCall;

  const openOverlay = React.useCallback(
    (options?: OpenOverlayOptions) => {
      if (!hubConfigured) return;

      const calleeId = options?.calleeId?.trim();
      if (calleeId) {
        setCallRemoteUserId(calleeId);
      }
      if (options?.remoteDisplayName) {
        setDisplayNameHint(options.remoteDisplayName);
      }
      setOverlayOpen(true);
    },
    [hubConfigured, setCallRemoteUserId],
  );

  const closeOverlay = React.useCallback(() => {
    setOverlayOpen(false);
    setDisplayNameHint(undefined);
  }, []);

  const remoteDisplayName = React.useMemo(() => {
    if (displayNameHint) return displayNameHint;
    if (!remoteUserId) return undefined;
    return resolveContactName(contacts, remoteUserId) ?? remoteUserId;
  }, [contacts, displayNameHint, remoteUserId]);

  const handleOverlayOpenChange = React.useCallback((open: boolean) => {
    setOverlayOpen(open);
    if (!open) {
      setDisplayNameHint(undefined);
    }
  }, []);

  const value = React.useMemo<VideoCallContextValue>(
    () => ({
      ...videoCall,
      overlayOpen,
      openOverlay,
      closeOverlay,
      remoteDisplayName,
    }),
    [videoCall, overlayOpen, openOverlay, closeOverlay, remoteDisplayName],
  );

  return (
    <VideoCallContext.Provider value={value}>
      {children}
      <VideoCallOverlay
        open={overlayOpen}
        onOpenChange={handleOverlayOpenChange}
        inComingCall={videoCall.inComingCall}
        isCallActive={videoCall.isCallActive}
        remoteDisplayName={remoteDisplayName}
        localStream={videoCall.localStream}
        remoteStream={videoCall.remoteStream}
        mediaError={videoCall.mediaError}
        connectionError={videoCall.connectionError}
        initSession={videoCall.initSession}
        endSession={videoCall.endSession}
        onStartCall={() => {
          void videoCall.startCall();
        }}
        onAccept={() => {
          stopPhoneRing();
          void videoCall.acceptCall();
        }}
        onDecline={() => {
          stopPhoneRing();
          videoCall.declineCall();
          closeOverlay();
        }}
        onEnd={() => {
          stopPhoneRing();
          videoCall.endCall();
        }}
      />
    </VideoCallContext.Provider>
  );
}

export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  return <VideoCallProviderInner>{children}</VideoCallProviderInner>;
}

export function useVideoCallContext(): VideoCallContextValue {
  const ctx = React.useContext(VideoCallContext);
  if (!ctx) {
    throw new Error("useVideoCallContext must be used within VideoCallProvider");
  }
  return ctx;
}

/** Safe when video call provider may be unavailable (e.g. unauthenticated). */
export function useVideoCallContextOptional(): VideoCallContextValue | null {
  return React.useContext(VideoCallContext);
}
