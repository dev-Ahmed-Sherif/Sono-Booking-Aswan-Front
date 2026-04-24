"use client";

import * as React from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScreenfullApi = {
  request: (element?: Element, options?: FullscreenOptions) => Promise<void>;
  exit: () => Promise<void>;
  isEnabled: boolean;
  isFullscreen: boolean;
};

/** True when app is launched as installed PWA or in fullscreen/standalone display mode (no browser chrome). */
function isStandaloneOrFullscreenDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window as Window & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const screenfullRef = React.useRef<ScreenfullApi | null>(null);

  React.useEffect(() => {
    import("screenfull").then((sf) => {
      screenfullRef.current = sf.default;
      const enabled = sf.default.isEnabled;
      setIsSupported(enabled);
      setIsFullscreen(sf.default.isFullscreen);

      const isPwaOrStandalone = isStandaloneOrFullscreenDisplay();

      // In PWA/standalone/kiosk: try fullscreen on load (often allowed without user gesture).
      // In normal browser tab: try anyway; fall back to prompt if rejected.
      if (enabled && !sf.default.isFullscreen) {
        sf.default.request().then(() => {
          setIsFullscreen(true);
          setShowPrompt(false);
        }).catch(() => {
          if (isPwaOrStandalone) return;
          setShowPrompt(true);
        });
      }
    });
  }, []);

  React.useEffect(() => {
    if (!screenfullRef.current?.isEnabled) return;
    const handler = () => setIsFullscreen(screenfullRef.current!.isFullscreen);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [isSupported]);

  const requestFullscreen = React.useCallback(() => {
    screenfullRef.current?.request().then(() => {
      setShowPrompt(false);
    }).catch(() => {});
  }, []);

  const exitFullscreen = React.useCallback(() => {
    screenfullRef.current?.exit();
  }, []);

  const fullscreenLayerZ = 2147483647;
  const exitButtonZ = 0; // Lowest z-index so it sits behind navbar and all app content when in fullscreen

  return (
    <>
      {children}
      {isSupported && showPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          style={{ zIndex: fullscreenLayerZ }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="fullscreen-prompt-title"
        >
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-primary/30 bg-card p-6 shadow-2xl">
            <h2 id="fullscreen-prompt-title" className="text-lg font-bold text-foreground">
              للعرض بملء الشاشة
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              يرجى فتح التطبيق بملء الشاشة للمتابعة
            </p>
            <Button size="lg" onClick={requestFullscreen} className="gap-2">
              <Maximize className="h-5 w-5" />
              فتح بملء الشاشة
            </Button>
          </div>
        </div>
      )}
      {isSupported && isFullscreen && (
        <Button
          size="icon"
          variant="ghost"
          className="fixed top-4 right-4 rounded-full bg-background/80 backdrop-blur z-0"
          style={{ zIndex: exitButtonZ }}
          onClick={exitFullscreen}
          aria-label="الخروج من ملء الشاشة"
        >
          <Minimize className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
