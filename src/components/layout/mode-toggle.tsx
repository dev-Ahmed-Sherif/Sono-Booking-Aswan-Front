"use client";

import type { FC } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, Maximize, Minimize } from "lucide-react";

type ScreenfullApi = {
  request: (element?: Element) => Promise<void>;
  exit: () => Promise<void>;
  isEnabled: boolean;
  isFullscreen: boolean;
};

const ModeToggle: FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [fullscreenSupported, setFullscreenSupported] = React.useState(false);
  const screenfullRef = React.useRef<ScreenfullApi | null>(null);

  React.useEffect(() => {
    import("screenfull").then((sf) => {
      screenfullRef.current = sf.default;
      setFullscreenSupported(sf.default.isEnabled);
      setIsFullscreen(sf.default.isFullscreen);
    });
  }, []);

  React.useEffect(() => {
    const handler = () => setIsFullscreen(screenfullRef.current?.isFullscreen ?? false);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleCurrentTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const toggleFullscreen = () => {
    if (!screenfullRef.current?.isEnabled) return;
    if (screenfullRef.current.isFullscreen) {
      screenfullRef.current.exit();
    } else {
      screenfullRef.current.request();
    }
  };

  const btnClass =
    "relative overflow-hidden group hover:scale-110 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/20 rounded-full border-2 border-transparent hover:border-primary/20";

  return (
    <div className="flex items-center gap-1">
      {fullscreenSupported && (
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "الخروج من ملء الشاشة" : "فتح بملء الشاشة"}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {isFullscreen ? (
            <Minimize className="h-6 w-6 relative z-10" />
          ) : (
            <Maximize className="h-6 w-6 relative z-10" />
          )}
          <span className="sr-only">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={btnClass}
        onClick={() => toggleCurrentTheme()}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Sun icon with enhanced animations */}
        <Sun className="h-6 w-6 rotate-0 scale-0 transition-all duration-500 dark:rotate-180 dark:scale-100 group-hover:rotate-12 group-hover:scale-110 relative z-10" />

        {/* Moon icon with enhanced animations */}
        <Moon className="absolute h-6 w-6 rotate-0 scale-100 transition-all duration-500 dark:rotate-180 dark:scale-0 group-hover:rotate-12 group-hover:scale-110 dark:hidden" />

        {/* Ripple effect on click */}
        <div className="absolute inset-0 rounded-full bg-primary/20 scale-0 group-active:scale-100 transition-transform duration-200 opacity-0 group-active:opacity-100" />

        {/* used for screen readers Accessibility */}
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  );
};

export default ModeToggle;
