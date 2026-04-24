"use client";

import { FC, useRef, useState, useCallback, useEffect } from "react";
import {
  Waves,
  Flame,
  Ship,
  Mountain,
  AlertTriangle,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react";

const EMERGENCY_Z_INDEX = 10002;
const STORAGE_KEY = "emergency-bar-position";
const STORAGE_KEY_STICKY = "emergency-bar-sticky";

const defaultPosition = { xPercent: 50, yPercent: 85 };
const MOBILE_BREAKPOINT = 768;

function loadPosition(): { xPercent: number; yPercent: number } {
  if (typeof window === "undefined") return defaultPosition;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s) as { xPercent: number; yPercent: number };
      if (typeof p.xPercent === "number" && typeof p.yPercent === "number")
        return p;
    }
  } catch (_) {}
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  return {
    xPercent: isMobile ? 20 : defaultPosition.xPercent,
    yPercent: defaultPosition.yPercent,
  };
}

function savePosition(p: { xPercent: number; yPercent: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (_) {}
}

function loadSticky(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const s = localStorage.getItem(STORAGE_KEY_STICKY);
    return s === "1" || s === "true";
  } catch (_) {}
  return false;
}

function saveSticky(sticky: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_STICKY, sticky ? "1" : "0");
  } catch (_) {}
}

/** Ship hitting mountain (collision with land) for بلاغ اصطدام */
function ShipIntoMountainIcon({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <Ship
        className="h-[0.9em] w-[0.9em] absolute left-0 top-1/2 -translate-y-1/2 rotate-[-12deg]"
        style={{ zIndex: 2 }}
      />
      <Mountain
        className="h-[1em] w-[1em]"
        style={{ position: "relative", marginLeft: "0.35em", zIndex: 1 }}
      />
    </span>
  );
}

const emergencyItems = [
  { icon: Waves, label: "بلاغ غرق", href: "#", iconColor: "text-sky-400" },
  { icon: Flame, label: "بلاغ حريق", href: "#", iconColor: "text-red-500" },
  {
    icon: Ship,
    label: "بلاغ شحوط",
    href: "#",
    iconClassName: "rotate-[60deg]",
    iconColor: "text-yellow-500",
  },
  {
    label: "بلاغ اصطدام",
    href: "#",
    customIcon: true,
    iconColor: "text-blue-800 dark:text-blue-700",
  },
];

const Emergency: FC = () => {
  const [position, setPosition] = useState(loadPosition);
  const [isSticky, setIsSticky] = useState(loadSticky);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const dragOffset = useRef({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mounted]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isSticky || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      hasMoved.current = false;
      setDragging(true);
      barRef.current.setPointerCapture(e.pointerId);
    },
    [isSticky],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || typeof window === "undefined") return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      let leftPx = e.clientX - dragOffset.current.x;
      let topPx = e.clientY - dragOffset.current.y;
      const rect = barRef.current?.getBoundingClientRect();
      const barW = rect?.width ?? 200;
      const barH = rect?.height ?? 60;
      leftPx = Math.max(0, Math.min(w - barW, leftPx));
      topPx = Math.max(0, Math.min(h - barH, topPx));
      const xPercent = (leftPx / w) * 100;
      const yPercent = (topPx / h) * 100;
      hasMoved.current = true;
      setPosition({ xPercent, yPercent });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      setDragging(false);
      setPosition((p) => {
        savePosition(p);
        return p;
      });
      setTimeout(() => {
        hasMoved.current = false;
      }, 0);
    }
  }, [dragging]);

  useEffect(() => {
    setPosition(loadPosition());
    setIsSticky(loadSticky());
  }, []);

  const toggleSticky = useCallback(() => {
    setIsSticky((prev) => {
      const next = !prev;
      saveSticky(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onUp = () => {
      setDragging(false);
      setTimeout(() => {
        hasMoved.current = false;
      }, 0);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const isNearLeft = position.xPercent <= 18;
  const isNearRight = position.xPercent >= 82;
  const isNearLeftOrRight = isNearLeft || isNearRight;
  const verticalLayout = mounted && (isMobile || isNearLeftOrRight);
  const showGrip = !(mounted && isSticky);
  const displaySticky = mounted && isSticky;
  const displayPosition = mounted ? position : defaultPosition;

  return (
    <div
      ref={barRef}
      role="group"
      aria-label="طوارئ"
      className={`fixed w-fit rounded-full border bg-background/95 px-2 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-700 select-none touch-none ${
        verticalLayout
          ? "flex flex-col gap-1 items-center"
          : "flex items-center gap-1 sm:gap-2 sm:px-4"
      }`}
      style={{
        zIndex: EMERGENCY_Z_INDEX,
        left: `${displayPosition.xPercent}%`,
        top: `${displayPosition.yPercent}%`,
        transform: "translate(0, 0)",
        cursor: displaySticky ? "default" : dragging ? "grabbing" : "grab",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className={
          verticalLayout
            ? "flex flex-col gap-1 items-center"
            : "flex items-center gap-2 sm:gap-6"
        }
      >
        {emergencyItems.map((item, index) => {
          const isCustom = "customIcon" in item && item.customIcon;
          const Icon = "icon" in item ? item.icon : null;
          return (
            <a
              key={index}
              href={item.href}
              onClick={(e) => {
                if (hasMoved.current) e.preventDefault();
              }}
              className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-primary transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
              aria-label={item.label}
              title={item.label}
            >
              <span className="flex items-center justify-center rounded-full border border-primary/40 dark:border-primary/50 p-1.5 sm:p-2">
                {isCustom ? (
                  <ShipIntoMountainIcon
                    className={`h-6 w-6 sm:h-7 sm:w-7 ${"iconColor" in item ? item.iconColor : "text-primary"}`}
                  />
                ) : (
                  Icon && (
                    <Icon
                      className={
                        "h-6 w-6 sm:h-7 sm:w-7 " +
                        ("iconColor" in item
                          ? item.iconColor + " "
                          : "text-primary ") +
                        ("iconClassName" in item && item.iconClassName
                          ? item.iconClassName
                          : "")
                      }
                    />
                  )
                )}
              </span>
              <span className="text-[10px] font-medium sm:text-xs">
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
      <div
        className={`flex gap-1.5 rounded-full border border-primary/40 dark:border-primary/50 px-2 py-1.5 sm:px-3 sm:py-2 text-muted-foreground ${
          verticalLayout ? "flex-col items-center" : "flex-row items-center"
        }`}
        aria-label="التاريخ والوقت"
      >
        <div
          className={`flex flex-col items-center ${verticalLayout ? "flex-col" : "items-start"}`}
        >
          <span className="text-sm sm:text-base text-center font-medium tabular-nums min-w-[4.5rem] sm:min-w-[5rem]">
            {mounted
              ? now.toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "\u200B"}
          </span>
          {verticalLayout ? (
            <div className="flex flex-col items-center min-w-[4rem] text-center">
              <span className="text-xs sm:text-sm">
                {mounted
                  ? now.toLocaleDateString("ar-EG", { weekday: "short" })
                  : "\u200B"}
              </span>
              <span className="text-xs sm:text-sm">
                {mounted
                  ? now.toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "\u200B"}
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm min-w-[4rem] text-center">
              {mounted
                ? now.toLocaleDateString("ar-EG", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "\u200B"}
            </span>
          )}
        </div>
      </div>
      <div
        className={`flex items-center gap-0.5 shrink-0 ${verticalLayout ? "flex-col" : ""}`}
      >
        {showGrip && (
          <span
            className="cursor-grab active:cursor-grabbing text-muted-foreground p-1 rounded hover:bg-primary/10"
            aria-hidden
            onPointerDown={handlePointerDown}
          >
            <GripVertical
              className={`h-4 w-4 sm:h-5 sm:w-5 ${verticalLayout ? "rotate-90" : ""}`}
            />
          </span>
        )}
        <button
          type="button"
          onClick={toggleSticky}
          className="p-1 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          aria-label={displaySticky ? "إلغاء التثبيت" : "ثبت الموضع"}
          title={displaySticky ? "إلغاء التثبيت" : "ثبت الموضع"}
        >
          {displaySticky ? (
            <PinOff className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Pin className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default Emergency;
