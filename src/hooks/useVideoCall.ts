"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import {
  ICE_SERVERS,
  VIDEO_HUB_METHODS,
} from "@/actions/chat/videoApi.contract";
import { getVideoHubUrl } from "@/lib/chat-env";
import { buildVideoHubConnection } from "@/lib/signalr/video-hub";

export type VideoCallPhase = "idle" | "incoming" | "outgoing" | "active";

export type UseVideoCallOptions = {
  enabled: boolean;
  onIncomingCall?: (senderId: string) => void;
  onCallEnded?: () => void;
};

export function useVideoCall({
  enabled,
  onIncomingCall,
  onCallEnded,
}: UseVideoCallOptions) {
  const hubUrl = getVideoHubUrl();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteUserIdRef = useRef("");
  const iceQueueRef = useRef<RTCIceCandidate[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const sessionOpenRef = useRef(false);
  const inComingCallRef = useRef(false);
  const isCallActiveRef = useRef(false);

  const [inComingCall, setInComingCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(signalR.HubConnectionState.Disconnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const onIncomingRef = useRef(onIncomingCall);
  onIncomingRef.current = onIncomingCall;

  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

  inComingCallRef.current = inComingCall;
  isCallActiveRef.current = isCallActive;

  const phase: VideoCallPhase = inComingCall
    ? "incoming"
    : isCallActive
      ? "active"
      : "idle";

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    iceQueueRef.current = [];
  }, []);

  const flushIceQueue = useCallback(async () => {
    const pc = peerRef.current;
    if (!pc?.remoteDescription) return;

    const queue = [...iceQueueRef.current];
    iceQueueRef.current = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("[video] addIceCandidate failed:", error);
      }
    }
  }, []);

  const sendIceCandidate = useCallback((receiverId: string, candidate: RTCIceCandidate) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    void conn
      .invoke(
        VIDEO_HUB_METHODS.sendIceCandidate,
        receiverId,
        JSON.stringify(candidate),
      )
      .catch((err) => console.error("[video] Error sending ice candidate:", err));
  }, []);

  const setupPeerConnection = useCallback(() => {
    closePeer();

    const receiverId = remoteUserIdRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && receiverId) {
        sendIceCandidate(receiverId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
      event.streams[0]?.getTracks().forEach((track) => {
        if (!stream!.getTracks().some((t) => t.id === track.id)) {
          stream!.addTrack(track);
        }
      });
    };

    return pc;
  }, [closePeer, sendIceCandidate]);

  const startLocalVideo = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setMediaError(null);

    const pc = peerRef.current;
    if (pc) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    return stream;
  }, []);

  const handleReceiveAnswer = useCallback(
    async (_senderId: string, answerJson: string) => {
      const pc = peerRef.current;
      if (!pc || !answerJson) return;

      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(answerJson) as RTCSessionDescriptionInit),
          );
          await flushIceQueue();
        } else {
          console.error(
            `[video] Cannot set remote description in state: ${pc.signalingState}`,
          );
        }
      } catch (error) {
        console.error("[video] Error setting remote description:", error);
      }
    },
    [flushIceQueue],
  );

  const handleReceiveIceCandidate = useCallback(
    async (_senderId: string, candidateJson: string) => {
      const pc = peerRef.current;
      if (!pc || !candidateJson) return;

      const candidate = new RTCIceCandidate(
        JSON.parse(candidateJson) as RTCIceCandidateInit,
      );

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.error("[video] addIceCandidate failed:", error);
        }
      } else {
        iceQueueRef.current.push(candidate);
      }
    },
    [],
  );

  const handleReceiveOffer = useCallback((senderId: string, offerJson: string) => {
    if (isCallActiveRef.current || inComingCallRef.current) return;

    remoteUserIdRef.current = senderId;
    setRemoteUserId(senderId);
    pendingOfferRef.current = JSON.parse(offerJson) as RTCSessionDescriptionInit;
    inComingCallRef.current = true;
    setInComingCall(true);
    onIncomingRef.current?.(senderId);
  }, []);

  const handleCallEnded = useCallback(() => {
    stopLocalTracks();
    closePeer();
    pendingOfferRef.current = null;
    remoteUserIdRef.current = "";
    setRemoteUserId("");
    inComingCallRef.current = false;
    isCallActiveRef.current = false;
    setInComingCall(false);
    setIsCallActive(false);
    onCallEndedRef.current?.();
  }, [closePeer, stopLocalTracks]);

  const handleReceiveOfferRef = useRef(handleReceiveOffer);
  const handleReceiveAnswerRef = useRef(handleReceiveAnswer);
  const handleReceiveIceCandidateRef = useRef(handleReceiveIceCandidate);
  const handleCallEndedRef = useRef(handleCallEnded);
  handleReceiveOfferRef.current = handleReceiveOffer;
  handleReceiveAnswerRef.current = handleReceiveAnswer;
  handleReceiveIceCandidateRef.current = handleReceiveIceCandidate;
  handleCallEndedRef.current = handleCallEnded;

  const startConnection = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state === signalR.HubConnectionState.Connected) return;

    try {
      await conn.start();
      setConnectionError(null);
      setConnectionState(conn.state);
      if (process.env.NODE_ENV === "development") {
        console.log("[video] Connected to video hub");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConnectionError(message);
      setConnectionState(conn.state);
      console.log("[video] Connection error", err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hubUrl) {
      setConnectionError(hubUrl ? null : "NEXT_PUBLIC_VIDEO_HUB_URL is not configured");
      return undefined;
    }

    const connection = buildVideoHubConnection(hubUrl, {
      onReceiveOffer: (senderId, offer) => {
        handleReceiveOfferRef.current(senderId, offer);
      },
      onReceiveAnswer: (senderId, answer) => {
        void handleReceiveAnswerRef.current(senderId, answer);
      },
      onReceiveIceCandidate: (senderId, candidate) => {
        void handleReceiveIceCandidateRef.current(senderId, candidate);
      },
      onCallEnded: () => {
        handleCallEndedRef.current();
      },
    });

    connectionRef.current = connection;

    const updateState = () => setConnectionState(connection.state);
    connection.onclose(updateState);
    connection.onreconnecting(updateState);
    connection.onreconnected(() => {
      setConnectionError(null);
      updateState();
    });

    void startConnection();

    return () => {
      void connection.stop().catch(() => {});
      if (connectionRef.current === connection) {
        connectionRef.current = null;
        setConnectionState(signalR.HubConnectionState.Disconnected);
      }
    };
  }, [enabled, hubUrl, startConnection]);

  const initSession = useCallback(async () => {
    if (sessionOpenRef.current) return;
    sessionOpenRef.current = true;

    setupPeerConnection();
    try {
      await startLocalVideo();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMediaError(message);
      console.error("[video] getUserMedia failed:", error);
    }
    await startConnection();
  }, [setupPeerConnection, startConnection, startLocalVideo]);

  const endSession = useCallback(() => {
    sessionOpenRef.current = false;
    stopLocalTracks();
    closePeer();
    pendingOfferRef.current = null;
  }, [closePeer, stopLocalTracks]);

  const setCallRemoteUserId = useCallback((userId: string) => {
    remoteUserIdRef.current = userId;
    setRemoteUserId(userId);
  }, []);

  const startCall = useCallback(async () => {
    const receiverId = remoteUserIdRef.current;
    const pc = peerRef.current;
    const conn = connectionRef.current;
    if (!receiverId || !pc || !conn) return;

    isCallActiveRef.current = true;
    setIsCallActive(true);

    const offer = await pc.createOffer();
    if (pc.signalingState === "stable") {
      await pc.setLocalDescription(offer);
      void conn
        .invoke(VIDEO_HUB_METHODS.sendOffer, receiverId, JSON.stringify(offer))
        .catch((err) => console.error("[video] Error sending offer:", err));
    }
  }, []);

  const acceptCall = useCallback(async () => {
    const receiverId = remoteUserIdRef.current;
    const offer = pendingOfferRef.current;
    const pc = peerRef.current;
    const conn = connectionRef.current;
    if (!offer || !pc || !conn) return;

    inComingCallRef.current = false;
    isCallActiveRef.current = true;
    setInComingCall(false);
    setIsCallActive(true);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    if (pc.signalingState === "have-remote-offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      void conn
        .invoke(VIDEO_HUB_METHODS.sendAnswer, receiverId, JSON.stringify(answer))
        .catch((err) => console.error("[video] Error sending answer:", err));
    }
  }, []);

  const declineCall = useCallback(() => {
    const receiverId = remoteUserIdRef.current;
    inComingCallRef.current = false;
    isCallActiveRef.current = false;
    setInComingCall(false);
    setIsCallActive(false);

    const conn = connectionRef.current;
    if (receiverId && conn?.state === signalR.HubConnectionState.Connected) {
      void conn
        .invoke(VIDEO_HUB_METHODS.endCall, receiverId)
        .catch((err) => console.error("[video] Error sending end call:", err));
    }

    endSession();
    remoteUserIdRef.current = "";
    setRemoteUserId("");
    onCallEndedRef.current?.();
  }, [endSession]);

  const endCall = useCallback(() => {
    const receiverId = remoteUserIdRef.current;

    isCallActiveRef.current = false;
    inComingCallRef.current = false;
    setIsCallActive(false);
    setInComingCall(false);
    remoteUserIdRef.current = "";
    setRemoteUserId("");

    endSession();

    const conn = connectionRef.current;
    if (receiverId && conn?.state === signalR.HubConnectionState.Connected) {
      void conn
        .invoke(VIDEO_HUB_METHODS.endCall, receiverId)
        .catch((err) => console.error("[video] Error sending end call:", err));
    }

    onCallEndedRef.current?.();
  }, [endSession]);

  return {
    hubUrl,
    hubConfigured: Boolean(hubUrl),
    isHubConnected: connectionState === signalR.HubConnectionState.Connected,
    isHubConnecting:
      connectionState === signalR.HubConnectionState.Connecting ||
      connectionState === signalR.HubConnectionState.Reconnecting,
    connectionError,
    phase,
    inComingCall,
    isCallActive,
    remoteUserId,
    localStream,
    remoteStream,
    mediaError,
    callError: null,
    isStartingCall: false,
    initSession,
    endSession,
    setCallRemoteUserId,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    retryConnection: startConnection,
  };
}
