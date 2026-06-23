"use client";



import * as signalR from "@microsoft/signalr";

import { NOTIFICATION_HUB_EVENTS } from "@/actions/notifications/notificationApi.contract";

import {
  applySignalRTimeouts,
  buildSignalRHttpOptions,
} from "@/lib/signalr/connection-options";



export type NotificationHubHandlers = {

  onReceiveNotification: (payload: unknown) => void;

  onUnreadCountUpdated?: (count: number) => void;

};



export function buildNotificationHubConnection(

  hubUrl: string,

  handlers: NotificationHubHandlers,

): signalR.HubConnection {

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, buildSignalRHttpOptions(hubUrl))
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .build();

  applySignalRTimeouts(connection);



  connection.on(

    NOTIFICATION_HUB_EVENTS.receiveNotification,

    (payload: unknown) => {

      handlers.onReceiveNotification(payload);

    },

  );



  if (handlers.onUnreadCountUpdated) {

    connection.on(

      NOTIFICATION_HUB_EVENTS.unreadCountUpdated,

      (count: number) => {

        handlers.onUnreadCountUpdated?.(count);

      },

    );

  }



  return connection;

}


