"use client";

import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { getNotificationHubUrl } from "@/lib/chat-env";
import { buildNotificationHubConnection } from "@/lib/signalr/notification-hub";

export type UseNotificationConnectionOptions = {
  enabled: boolean;
  onReceiveNotification: (payload: unknown) => void;
  onUnreadCountUpdated?: (count: number) => void;
};

export function useNotificationConnection({
  enabled,
  onReceiveNotification,
  onUnreadCountUpdated,
}: UseNotificationConnectionOptions) {
  const hubUrl = getNotificationHubUrl();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(signalR.HubConnectionState.Disconnected);

  const onNotificationRef = useRef(onReceiveNotification);
  const onCountRef = useRef(onUnreadCountUpdated);
  onNotificationRef.current = onReceiveNotification;
  onCountRef.current = onUnreadCountUpdated;

  useEffect(() => {
    if (!enabled || !hubUrl) {
      return undefined;
    }

    const connection = buildNotificationHubConnection(hubUrl, {
      onReceiveNotification: (p) => onNotificationRef.current(p),
      onUnreadCountUpdated: (c) => onCountRef.current?.(c),
    });

    connectionRef.current = connection;

    const updateState = () => setConnectionState(connection.state);
    connection.onclose(updateState);
    connection.onreconnecting(updateState);
    connection.onreconnected(updateState);

    connection
      .start()
      .then(updateState)
      .catch(() => {
        updateState();
      });

    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        connection.state === signalR.HubConnectionState.Disconnected
      ) {
        connection.start().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      connection
        .stop()
        .catch(() => {})
        .finally(() => {
          connectionRef.current = null;
          setConnectionState(signalR.HubConnectionState.Disconnected);
        });
    };
  }, [enabled, hubUrl]);

  const isConnected = connectionState === signalR.HubConnectionState.Connected;

  return {
    hubConfigured: Boolean(hubUrl),
    isConnected,
    connectionState,
  };
}
