/** Browser: set `NEXT_PUBLIC_SIGNALR_HUB_URL` to your SignalR hub URL (see `chatApi.contract.ts`). */
export function getSignalRHubUrl(): string {
  return (process.env.NEXT_PUBLIC_SIGNALR_HUB_URL ?? "").trim();
}
