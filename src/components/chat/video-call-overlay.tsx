"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Phone, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type VideoCallOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inComingCall: boolean;
  isCallActive: boolean;
  remoteDisplayName?: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mediaError: string | null;
  connectionError?: string | null;
  initSession: () => Promise<void>;
  endSession: () => void;
  onStartCall: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
};

function VideoPane({
  stream,
  muted,
  className,
  label,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label: string;
}) {
  const ref = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className={className}
    />
  );
}

export function VideoCallOverlay({
  open,
  onOpenChange,
  inComingCall,
  isCallActive,
  remoteDisplayName,
  localStream,
  remoteStream,
  mediaError,
  connectionError = null,
  initSession,
  endSession,
  onStartCall,
  onAccept,
  onDecline,
  onEnd,
}: VideoCallOverlayProps) {
  const t = useTranslations("Chat.videoCall");

  React.useEffect(() => {
    if (!open) {
      endSession();
      return;
    }

    void initSession();
  }, [open, initSession, endSession]);

  const handleClose = (next: boolean) => {
    if (!next) {
      onEnd();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideCloseButton
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-xl"
        overlayClassName="z-[10002]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full bg-black">
          <VideoPane
            stream={remoteStream}
            className="absolute inset-0 h-full w-full object-cover"
            label={t("remoteVideo")}
          />
          <VideoPane
            stream={localStream}
            muted
            className="absolute end-4 top-4 z-10 h-28 w-36 rounded-lg border-2 border-blue-500 object-cover shadow-lg sm:h-36 sm:w-48"
            label={t("localVideo")}
          />

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-10">
            {inComingCall && (
              <p className="mb-3 text-center text-sm font-medium text-white">
                {t("incoming", {
                  name: remoteDisplayName ?? t("unknownCaller"),
                })}
              </p>
            )}

            {mediaError && (
              <p className="mb-3 text-center text-xs text-red-300">{mediaError}</p>
            )}

            {connectionError && (
              <p className="mb-3 text-center text-xs text-amber-200">
                {connectionError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {inComingCall && (
                <>
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={onAccept}
                  >
                    <Phone className="me-2 h-4 w-4" />
                    {t("accept")}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className="rounded-full"
                    onClick={onDecline}
                  >
                    <PhoneOff className="me-2 h-4 w-4" />
                    {t("decline")}
                  </Button>
                </>
              )}

              {!inComingCall && !isCallActive && (
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={onStartCall}
                >
                  <Phone className="me-2 h-4 w-4" />
                  {t("startCall")}
                </Button>
              )}

              {!inComingCall && (
                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  className={cn("rounded-full")}
                  onClick={onEnd}
                >
                  <PhoneOff className="me-2 h-4 w-4" />
                  {t("endCall")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
