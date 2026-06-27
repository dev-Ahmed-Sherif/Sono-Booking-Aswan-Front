"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChatPanelOptional } from "@/contexts/chat-panel-context";
import { useTranslations } from "next-intl";
import {
  formatUtcToCairo,
  parseUtcDate,
} from "@/lib/date-timeOptions";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  Bell,
  CalendarCheck,
  CheckCheck,
  ClipboardList,
  Loader2,
  MessageSquare,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  initNotificationSoundUnlock,
  playNotificationSound,
  stopNotificationSound,
} from "@/lib/notification-sound";
import { useNotificationConnection } from "@/hooks/useNotificationConnection";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications/notificationService";
import {
  notificationSchema,
  type AppNotification,
} from "@/schemas/notification";

type NotificationBellProps = {
  locale: string;
};

function normalizeNotification(payload: unknown): AppNotification | null {
  const parsed = notificationSchema.safeParse(payload);
  if (parsed.success) return parsed.data;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    return {
      id: String(o.id ?? `n-${Date.now()}`),
      type: String(o.type ?? "system"),
      content: String(o.content ?? ""),
      referenceId: o.referenceId != null ? String(o.referenceId) : null,
      groupType: o.groupType != null ? String(o.groupType) : null,
      groupNameAr: o.groupNameAr != null ? String(o.groupNameAr) : null,
      groupNameEn: o.groupNameEn != null ? String(o.groupNameEn) : null,
      senderId: String(o.senderId ?? ""),
      senderName: o.senderName != null ? String(o.senderName) : null,
      isRead: Boolean(o.isRead),
      createdAt: o.createdAt != null ? String(o.createdAt) : null,
    };
  }
  return null;
}

function typeIcon(type: string) {
  switch (type) {
    case "chat":
      return MessageSquare;
    case "request":
      return ClipboardList;
    case "reservation":
      return CalendarCheck;
    default:
      return Settings2;
  }
}

function typeStyles(type: string): string {
  switch (type) {
    case "chat":
      return "bg-emerald-500/15 text-emerald-600";
    case "request":
      return "bg-amber-500/15 text-amber-700";
    case "reservation":
      return "bg-blue-500/15 text-blue-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function NotificationBell({ locale }: NotificationBellProps) {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const chatPanel = useChatPanelOptional();
  const dateLocale = locale === "ar" ? ar : enUS;

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [notifications, setNotifications] = React.useState<AppNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [markingAll, setMarkingAll] = React.useState(false);
  const prevUnreadRef = React.useRef<number | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [listRes, countRes] = await Promise.all([
      getNotifications({ take: 25 }),
      getUnreadNotificationCount(),
    ]);
    setLoading(false);
    if ("data" in listRes && Array.isArray(listRes.data)) {
      setNotifications(listRes.data);
    }
    if ("data" in countRes && typeof countRes.data === "number") {
      setUnreadCount(countRes.data);
    }
  }, []);

  React.useEffect(() => {
    return initNotificationSoundUnlock();
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (unreadCount === 0) {
      stopNotificationSound();
    }
  }, [unreadCount]);

  React.useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev === null) {
      prevUnreadRef.current = unreadCount;
      if (unreadCount > 0) {
        playNotificationSound();
      }
      return;
    }

    if (unreadCount > prev) {
      playNotificationSound();
    }

    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const onReceiveNotification = React.useCallback((payload: unknown) => {
    const n = normalizeNotification(payload);
    if (!n) return;
    setNotifications((prev) => {
      if (prev.some((item) => item.id === n.id)) return prev;
      return [n, ...prev].slice(0, 30);
    });
    if (!n.isRead) {
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const onUnreadCountUpdated = React.useCallback((count: number) => {
    if (Number.isFinite(count)) {
      setUnreadCount(count);
    }
  }, []);

  useNotificationConnection({
    enabled: true,
    onReceiveNotification,
    onUnreadCountUpdated,
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      refresh();
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    const res = await markAllNotificationsRead();
    setMarkingAll(false);
    if (!("error" in res && res.error)) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const handleItemClick = async (n: AppNotification) => {
    if (!n.isRead) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    setOpen(false);
    if (n.type === "chat" && n.referenceId) {
      if (chatPanel) {
        chatPanel.openConversation(n.referenceId);
      } else {
        router.push(
          `/${locale}/chat?conversation=${encodeURIComponent(n.referenceId)}`,
        );
      }
      return;
    }
    if (n.type === "request") {
      const ownerDecision =
        n.content.includes("طلبك") ||
        n.content.includes("تمت الموافقة") ||
        n.content.includes("تم رفض");
      router.push(
        `/${locale}/${ownerDecision ? "housing-sender" : "housing-receiver"}`,
      );
      return;
    }
    if (n.type === "reservation") {
      router.push(`/${locale}/reservation`);
    }
  };

  const formatRelativeTime = (value?: string | null) => {
    if (!value) return "";
    const d = parseUtcDate(value);
    if (!d) return "";
    return formatDistanceToNow(d, { addSuffix: true, locale: dateLocale });
  };

  const formatAbsoluteTime = (value?: string | null) => {
    if (!value) return "";
    const formatted = formatUtcToCairo(value);
    return formatted === "-" ? "" : formatted;
  };

  const notificationTitle = (n: AppNotification) => {
    if (n.type === "request" || n.type === "reservation") {
      return t(`types.${n.type}`);
    }
    return n.senderName || t(`types.${n.type}`);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "group relative h-12 w-12 shrink-0 overflow-visible rounded-full border-0 p-0 shadow-none transition-all duration-300",
            "hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2",
            "data-[state=open]:bg-amber-500/15 data-[state=open]:ring-2 data-[state=open]:ring-amber-500/30",
            "sm:h-[3.35rem] sm:w-[3.35rem]",
            "[&_svg]:!size-10 sm:[&_svg]:!size-[2.65rem]",
          )}
          aria-label={t("title")}
        >
          {unreadCount > 0 && (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span className="absolute inset-0 rounded-full bg-amber-400/60 blur-lg animate-bell-glow dark:bg-amber-400/50" />
              <span className="absolute inset-0 rounded-full border-[2.5px] border-amber-500/90 animate-bell-ring dark:border-amber-400/85" />
              <span
                className="absolute inset-0 rounded-full border-2 border-amber-500/70 animate-bell-ring dark:border-amber-400/65"
                style={{ animationDelay: "1s" }}
              />
            </span>
          )}
          <Bell
            className={cn(
              "relative z-[1] fill-amber-500 text-amber-600",
              "drop-shadow-[0_2px_6px_rgba(245,158,11,0.45)]",
              "dark:fill-amber-400 dark:text-amber-500 dark:drop-shadow-[0_2px_8px_rgba(251,191,36,0.35)]",
              unreadCount > 0
                ? "animate-bell-shake"
                : "transition-transform duration-300 group-hover:scale-110 group-active:scale-95",
            )}
            strokeWidth={2}
            aria-hidden
          />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                "absolute -top-0.5 -end-0.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5",
                "text-[11px] font-bold leading-none shadow-md shadow-destructive/40 ring-2 ring-background",
                "animate-pulse motion-reduce:animate-none",
              )}
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        collisionPadding={{ left: 16, right: 16, top: 8, bottom: 8 }}
        className="w-[min(calc(100vw-3rem),30rem)] overflow-hidden rounded-xl border border-border/60 p-0 text-base shadow-xl shadow-black/10 dark:shadow-black/40"
        sideOffset={10}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-amber-500/8 via-background to-primary/5 px-5 py-3.5">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">{t("title")}</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-sm text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
            disabled={markingAll || unreadCount === 0}
            onClick={handleMarkAll}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {t("markAllRead")}
          </Button>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-amber-600/70 dark:text-amber-400/70" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-base text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {notifications.map((n) => {
                const Icon = typeIcon(n.type);
                const groupLabel =
                  locale === "ar"
                    ? (n.groupNameAr ?? n.groupNameEn)
                    : (n.groupNameEn ?? n.groupNameAr);
                const showSender =
                  (n.type === "request" || n.type === "reservation") &&
                  n.senderName?.trim();
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "flex w-full gap-3.5 px-5 py-3.5 text-start transition-all duration-200",
                        "hover:bg-muted/60 active:scale-[0.99]",
                        !n.isRead &&
                          "border-s-[3px] border-s-amber-500 bg-amber-500/[0.07] dark:bg-amber-400/[0.09]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
                          typeStyles(n.type),
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-lg font-semibold">
                            {notificationTitle(n)}
                          </span>
                          {!n.isRead && (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)] dark:bg-amber-400" />
                          )}
                        </span>
                        <span className="mt-1 line-clamp-3 text-base leading-relaxed text-muted-foreground">
                          {n.content}
                        </span>
                        {showSender ? (
                          <span className="mt-1 block text-xs font-medium text-muted-foreground">
                            {t("fromSender", { name: n.senderName!.trim() })}
                          </span>
                        ) : null}
                        {n.type === "chat" && groupLabel ? (
                          <span className="mt-1 block text-xs font-medium text-muted-foreground">
                            {groupLabel}
                          </span>
                        ) : null}
                        {n.createdAt ? (
                          <span
                            className="mt-1.5 block text-xs text-muted-foreground/80"
                            title={formatAbsoluteTime(n.createdAt)}
                          >
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
