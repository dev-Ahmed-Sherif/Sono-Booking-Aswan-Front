"use client";

export class SignalRAccessTokenError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SignalRAccessTokenError";
    this.status = status;
  }
}

/** Reads the httpOnly access-token cookie via the Next.js API route. */
export async function fetchSignalRAccessToken(): Promise<string> {
  const res = await fetch("/api/signalr/access-token", {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = res.statusText || "Unauthorized";
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? detail;
    } catch {
      /* ignore parse errors */
    }
    throw new SignalRAccessTokenError(detail, res.status);
  }

  const body = (await res.json()) as { accessToken?: string };
  if (!body.accessToken) {
    throw new SignalRAccessTokenError("No access token in response");
  }

  return body.accessToken;
}
