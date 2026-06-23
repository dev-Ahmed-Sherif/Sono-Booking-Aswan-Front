"use client";



import * as signalR from "@microsoft/signalr";

import { VIDEO_HUB_EVENTS } from "@/actions/chat/videoApi.contract";

import {
  applySignalRTimeouts,
  buildSignalRHttpOptions,
} from "@/lib/signalr/connection-options";



export type VideoHubHandlers = {

  onReceiveOffer: (senderId: string, offer: string) => void;

  onReceiveAnswer: (senderId: string, answer: string) => void;

  onReceiveIceCandidate: (senderId: string, candidate: string) => void;

  onCallEnded: () => void;

};



export function buildVideoHubConnection(

  hubUrl: string,

  handlers: VideoHubHandlers,

): signalR.HubConnection {

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, buildSignalRHttpOptions(hubUrl))
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  applySignalRTimeouts(connection);



  connection.on(VIDEO_HUB_EVENTS.receiveOffer, (senderId: string, offer: string) => {

    handlers.onReceiveOffer(senderId, offer);

  });



  connection.on(VIDEO_HUB_EVENTS.receiveAnswer, (senderId: string, answer: string) => {

    handlers.onReceiveAnswer(senderId, answer);

  });



  connection.on(

    VIDEO_HUB_EVENTS.receiveIceCandidate,

    (senderId: string, candidate: string) => {

      handlers.onReceiveIceCandidate(senderId, candidate);

    },

  );



  connection.on(VIDEO_HUB_EVENTS.callEnded, () => {

    handlers.onCallEnded();

  });



  return connection;

}


