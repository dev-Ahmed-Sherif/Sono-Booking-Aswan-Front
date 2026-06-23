"use client";

import * as signalR from "@microsoft/signalr";

import { fetchSignalRAccessToken } from "@/lib/signalr/access-token";

/** SignalR client timeouts — align with backend KeepAlive / ClientTimeout. */
export const SIGNALR_SERVER_TIMEOUT_MS = 60_000;
export const SIGNALR_KEEP_ALIVE_MS = 15_000;

/**
 * IIS Express (typical local port 57951) often lacks WebSocket upgrade.
 * Long polling to the API origin avoids negotiate/WebSocket failures in that setup.
 */
function shouldForceLongPolling(hubUrl: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const parsed = new URL(hubUrl, window.location.origin);
    return parsed.port === "57951";
  } catch {
    return false;
  }
}

export function buildSignalRHttpOptions(
  hubUrl: string,
): signalR.IHttpConnectionOptions {
  const forceLongPolling = shouldForceLongPolling(hubUrl);

  return {
    accessTokenFactory: fetchSignalRAccessToken,
    transport: forceLongPolling
      ? signalR.HttpTransportType.LongPolling
      : signalR.HttpTransportType.WebSockets |
        signalR.HttpTransportType.ServerSentEvents |
        signalR.HttpTransportType.LongPolling,
    skipNegotiation: false,
  };
}

export function applySignalRTimeouts(connection: signalR.HubConnection): void {
  connection.serverTimeoutInMilliseconds = SIGNALR_SERVER_TIMEOUT_MS;
  connection.keepAliveIntervalInMilliseconds = SIGNALR_KEEP_ALIVE_MS;
}
