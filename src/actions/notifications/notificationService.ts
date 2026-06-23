"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import { NOTIFICATION_API_PATHS } from "@/actions/notifications/notificationApi.contract";
import {
  notificationSchema,
  type AppNotification,
} from "@/schemas/notification";

type AxiosErrorResponse = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      [key: string]: unknown;
    };
  };
  message?: string;
};

function unwrapBody(raw: unknown): unknown {
  if (raw && typeof raw === "object" && raw !== null && "data" in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function parseNotificationList(raw: unknown): AppNotification[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: AppNotification[] = [];
  for (const item of arr) {
    const p = notificationSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseUnreadCount(raw: unknown): number {
  const inner = unwrapBody(raw);
  if (inner && typeof inner === "object" && "count" in inner) {
    const n = Number((inner as { count: unknown }).count);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const getNotifications = async (options?: {
  take?: number;
  onlyUnread?: boolean;
}) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const params = new URLSearchParams();
    if (options?.take != null) params.set("take", String(options.take));
    if (options?.onlyUnread) params.set("onlyUnread", "true");
    const qs = params.toString();
    const url = `${process.env.BACK_END}${NOTIFICATION_API_PATHS.list}${qs ? `?${qs}` : ""}`;

    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return { data: parseNotificationList(res.data) };
  } catch (error: unknown) {
    const err = error as AxiosErrorResponse;
    return {
      error: "Failed to load notifications",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getUnreadNotificationCount = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}${NOTIFICATION_API_PATHS.unreadCount}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: parseUnreadCount(res.data) };
  } catch (error: unknown) {
    const err = error as AxiosErrorResponse;
    return {
      error: "Failed to load unread count",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const markNotificationRead = async (notificationId: string) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    await axios.patch(
      `${process.env.BACK_END}${NOTIFICATION_API_PATHS.markRead(notificationId)}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: true };
  } catch (error: unknown) {
    const err = error as AxiosErrorResponse;
    return {
      error: "Failed to mark notification read",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const markAllNotificationsRead = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    await axios.patch(
      `${process.env.BACK_END}${NOTIFICATION_API_PATHS.markAllRead}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: true };
  } catch (error: unknown) {
    const err = error as AxiosErrorResponse;
    return {
      error: "Failed to mark all read",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
};
