/**
 * Video call SignalR contract — align with `VideoChatHub` on the ASP.NET API.
 *
 * ## SignalR
 *
 * - **Hub URL:** `NEXT_PUBLIC_VIDEO_HUB_URL` or derived from chat hub (`/chat` → `/video`)
 * - **Auth:** JWT via `accessTokenFactory` (see `/api/signalr/access-token`)
 *
 * **Client → server (Invoke):**
 * - `SendOffer` — `(receiverId: string, offer: string)` — JSON-serialized RTCSessionDescriptionInit
 * - `SendAnswer` — `(receiverId: string, answer: string)` — JSON-serialized RTCSessionDescriptionInit
 * - `SendIceCandidate` — `(receiverId: string, candidate: string)` — JSON-serialized RTCIceCandidateInit
 * - `EndCall` — `(receiverId: string)`
 *
 * **Server → client (On):**
 * - `ReceiveOffer` — `(senderId: string, offer: string)`
 * - `ReceiveAnswer` — `(senderId: string, answer: string)`
 * - `ReceiveIceCandidate` — `(senderId: string, candidate: string)`
 * - `CallEnded` — `()`
 */

export const VIDEO_HUB_METHODS = {
  sendOffer: "SendOffer",
  sendAnswer: "SendAnswer",
  sendIceCandidate: "SendIceCandidate",
  endCall: "EndCall",
} as const;

export const VIDEO_HUB_EVENTS = {
  receiveOffer: "ReceiveOffer",
  receiveAnswer: "ReceiveAnswer",
  receiveIceCandidate: "ReceiveIceCandidate",
  callEnded: "CallEnded",
} as const;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];
