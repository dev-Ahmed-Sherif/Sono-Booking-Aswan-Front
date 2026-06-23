"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import * as signalR from "@microsoft/signalr";

import { CHAT_HUB_METHODS, type UserOnlineStatus } from "@/actions/chat/chatApi.contract";
import { getChatOnlineStatuses } from "@/actions/chat/chatService";

import { getSignalRHubUrl } from "@/lib/chat-env";

import { buildChatHubConnection } from "@/lib/signalr/chat-hub";

/** Survives hook remounts / hub disconnect so dots stay until DB refresh. */
const persistedOnlineUserIds = new Set<string>();

export type UseChatConnectionOptions = {
  enabled: boolean;
  onReceiveMessage: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
  /** User ids to query for online status (conversations + contacts). */
  watchUserIds?: string[];
  /** When true, triggers a DB presence refresh (e.g. chat panel opened). */
  panelOpen?: boolean;
};

function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

function cloneOnlineSet(source: Set<string>): Set<string> {
  return new Set(source);
}

function toWatchUserIdsKey(userIds: string[]): string {
  return userIds
    .map(normalizeUserId)
    .filter(Boolean)
    .sort()
    .join("|");
}

function normalizeOnlineStatuses(payload: unknown): UserOnlineStatus[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const o = item as Record<string, unknown>;
      const userIdRaw = o.userId ?? o.UserId;
      const isOnlineRaw = o.isOnline ?? o.IsOnline;
      if (userIdRaw == null) {
        return null;
      }
      return {
        userId: normalizeUserId(String(userIdRaw)),
        isOnline: Boolean(isOnlineRaw),
      };
    })
    .filter((item): item is UserOnlineStatus => item != null);
}

function formatConnectionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function schedulePresenceRefresh(
  fetchFn: () => Promise<void>,
  cancelled: () => boolean,
): void {
  const delaysMs = [0, 300, 800, 2000];
  for (const delayMs of delaysMs) {
    setTimeout(() => {
      if (!cancelled()) {
        void fetchFn();
      }
    }, delayMs);
  }
}

export function useChatConnection({
  enabled,
  onReceiveMessage,
  onConversationUpdated,
  watchUserIds = [],
  panelOpen = true,
}: UseChatConnectionOptions) {
  const hubUrl = getSignalRHubUrl();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const joinedIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);
  const panelOpenRef = useRef(panelOpen);

  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(signalR.HubConnectionState.Disconnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() =>
    cloneOnlineSet(persistedOnlineUserIds),
  );

  const onMessageRef = useRef(onReceiveMessage);
  const onConvRef = useRef(onConversationUpdated);
  onMessageRef.current = onReceiveMessage;
  onConvRef.current = onConversationUpdated;

  const watchUserIdsRef = useRef(watchUserIds);
  watchUserIdsRef.current = watchUserIds;
  const watchUserIdsKey = toWatchUserIdsKey(watchUserIds);

  const syncOnlineUserIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setOnlineUserIds((prev) => {
      const next = updater(prev);
      persistedOnlineUserIds.clear();
      for (const id of next) {
        persistedOnlineUserIds.add(id);
      }
      return next;
    });
  }, []);

  const applyPresenceUpdate = useCallback(
    (userId: string, isOnline: boolean) => {
      const normalizedUserId = normalizeUserId(userId);
      if (!normalizedUserId) {
        return;
      }

      syncOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(normalizedUserId);
        } else {
          next.delete(normalizedUserId);
        }
        return next;
      });
    },
    [syncOnlineUserIds],
  );

  const applyOnlineStatuses = useCallback(
    (statuses: UserOnlineStatus[]) => {
      syncOnlineUserIds((prev) => {
        const next = new Set(prev);
        for (const status of statuses) {
          const normalizedUserId = normalizeUserId(status.userId);
          if (!normalizedUserId) continue;
          if (status.isOnline) {
            next.add(normalizedUserId);
          } else {
            next.delete(normalizedUserId);
          }
        }
        return next;
      });
    },
    [syncOnlineUserIds],
  );

  const fetchOnlineStatusesViaRest = useCallback(
    async (userIds: string[]) => {
      if (userIds.length === 0) {
        return;
      }

      try {
        const res = await getChatOnlineStatuses(userIds);
        if ("data" in res && Array.isArray(res.data)) {
          applyOnlineStatuses(res.data);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[chat] REST online-status failed:", err);
        }
      }
    },
    [applyOnlineStatuses],
  );

  const fetchOnlineStatuses = useCallback(async () => {
    const userIds = watchUserIdsRef.current.filter(Boolean);

    if (userIds.length === 0) {
      return;
    }

    await fetchOnlineStatusesViaRest(userIds);

    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      const result = await conn.invoke<unknown>(
        CHAT_HUB_METHODS.getOnlineStatuses,
        userIds,
      );
      applyOnlineStatuses(normalizeOnlineStatuses(result));
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[chat] GetOnlineStatuses failed:", err);
      }
    }
  }, [applyOnlineStatuses, fetchOnlineStatusesViaRest]);

  const fetchOnlineStatusesRef = useRef(fetchOnlineStatuses);
  fetchOnlineStatusesRef.current = fetchOnlineStatuses;

  const ensureJoinedToConversation = useCallback(async (conversationId: string) => {
    activeConversationIdRef.current = conversationId;

    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
      throw new Error("SignalR not connected");
    }

    if (joinedIdRef.current === conversationId) {
      return;
    }

    if (joinedIdRef.current) {
      try {
        await conn.invoke(CHAT_HUB_METHODS.leaveConversation, joinedIdRef.current);
      } catch {
        /* ignore */
      }
      joinedIdRef.current = null;
    }

    await conn.invoke(CHAT_HUB_METHODS.joinConversation, conversationId);
    joinedIdRef.current = conversationId;
  }, []);

  const ensureJoinedRef = useRef(ensureJoinedToConversation);
  ensureJoinedRef.current = ensureJoinedToConversation;

  const rejoinActiveConversationRef = useRef<() => Promise<void>>(async () => {});
  rejoinActiveConversationRef.current = async () => {
    const conversationId = activeConversationIdRef.current;
    if (!conversationId) {
      return;
    }
    joinedIdRef.current = null;
    try {
      await ensureJoinedRef.current(conversationId);
    } catch (err) {
      joinedIdRef.current = null;
      if (process.env.NODE_ENV === "development") {
        console.warn("[chat] JoinConversation failed:", err);
      }
    }
  };

  useEffect(() => {
    if (!enabled || !hubUrl) {
      setConnectionError(hubUrl ? null : "NEXT_PUBLIC_SIGNALR_HUB_URL is not configured");
      return undefined;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connection = buildChatHubConnection(hubUrl, {
      onReceiveMessage: (p) => onMessageRef.current(p),
      onConversationUpdated: (p) => onConvRef.current?.(p),
      onUserPresenceChanged: (payload) => {
        applyPresenceUpdate(payload.userId, payload.isOnline);
      },
    });

    connectionRef.current = connection;

    const updateState = () => {
      if (!cancelled) {
        setConnectionState(connection.state);
      }
    };

    const onConnected = () => {
      setConnectionError(null);
      updateState();
      void rejoinActiveConversationRef.current();
      schedulePresenceRefresh(
        () => fetchOnlineStatusesRef.current(),
        () => cancelled,
      );
    };

    const startWithRetry = (attempt = 0) => {
      if (cancelled || startingRef.current) {
        return;
      }

      if (connection.state === signalR.HubConnectionState.Connected) {
        onConnected();
        return;
      }

      if (connection.state === signalR.HubConnectionState.Connecting) {
        return;
      }

      startingRef.current = true;

      connection
        .start()
        .then(onConnected)
        .catch((err: unknown) => {
          const message = formatConnectionError(err);
          if (!cancelled) {
            setConnectionError(message);
            setConnectionState(connection.state);
          }
          if (process.env.NODE_ENV === "development") {
            console.error("[chat] SignalR connect failed:", message, err);
          }
          if (cancelled || attempt >= 5) {
            return;
          }
          const delay = Math.min(1000 * 2 ** attempt, 15000);
          retryTimer = setTimeout(() => startWithRetry(attempt + 1), delay);
        })
        .finally(() => {
          startingRef.current = false;
        });
    };

    connection.onclose((err) => {
      if (err && !cancelled) {
        setConnectionError(formatConnectionError(err));
      }
      updateState();
    });
    connection.onreconnecting((err) => {
      if (err && !cancelled) {
        setConnectionError(formatConnectionError(err));
      }
      updateState();
    });
    connection.onreconnected(onConnected);

    startWithRetry();

    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        connection.state === signalR.HubConnectionState.Disconnected
      ) {
        startWithRetry();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      document.removeEventListener("visibilitychange", onVis);
      joinedIdRef.current = null;
      activeConversationIdRef.current = null;
      startingRef.current = false;
      connection
        .stop()
        .catch(() => {})
        .finally(() => {
          connectionRef.current = null;
          setConnectionState(signalR.HubConnectionState.Disconnected);
        });
    };
  }, [enabled, hubUrl, applyPresenceUpdate]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void fetchOnlineStatuses();
  }, [enabled, connectionState, watchUserIdsKey, fetchOnlineStatuses]);

  useEffect(() => {
    if (!enabled || watchUserIds.length === 0) {
      return;
    }

    schedulePresenceRefresh(
      () => fetchOnlineStatusesRef.current(),
      () => false,
    );
  }, [enabled, watchUserIdsKey, watchUserIds.length]);

  useEffect(() => {
    const wasOpen = panelOpenRef.current;
    panelOpenRef.current = panelOpen;
    if (!wasOpen && panelOpen && enabled) {
      schedulePresenceRefresh(
        () => fetchOnlineStatusesRef.current(),
        () => false,
      );
    }
  }, [panelOpen, enabled]);

  const isUserOnline = useCallback(
    (userId: string) => onlineUserIds.has(normalizeUserId(userId)),
    [onlineUserIds],
  );

  const setActiveConversation = useCallback(
    async (conversationId: string | null) => {
      activeConversationIdRef.current = conversationId;

      if (!conversationId) {
        const conn = connectionRef.current;
        if (joinedIdRef.current && conn?.state === signalR.HubConnectionState.Connected) {
          try {
            await conn.invoke(CHAT_HUB_METHODS.leaveConversation, joinedIdRef.current);
          } catch {
            /* ignore */
          }
        }
        joinedIdRef.current = null;
        return;
      }

      try {
        await ensureJoinedToConversation(conversationId);
      } catch (err) {
        joinedIdRef.current = null;
        if (process.env.NODE_ENV === "development") {
          console.warn("[chat] setActiveConversation failed:", err);
        }
      }
    },
    [ensureJoinedToConversation],
  );

  const sendViaHub = useCallback(
    async (conversationId: string, content: string) => {
      await ensureJoinedToConversation(conversationId);
      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
        throw new Error("SignalR not connected");
      }
      await conn.invoke(CHAT_HUB_METHODS.sendMessage, conversationId, content.trim());
    },
    [ensureJoinedToConversation],
  );

  return {
    hubUrl,
    hubConfigured: Boolean(hubUrl),
    connectionState,
    connectionError,
    isConnected: connectionState === signalR.HubConnectionState.Connected,
    setActiveConversation,
    sendViaHub,
    onlineUserIds,
    isUserOnline,
    refreshOnlineStatuses: fetchOnlineStatuses,
  };
}
