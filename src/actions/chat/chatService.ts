"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import {
  CHAT_API_PATHS,
} from "@/actions/chat/chatApi.contract";
import type { UserOnlineStatus } from "@/actions/chat/chatApi.contract";
import {
  chatConversationSchema,
  chatContactSchema,
  chatMessageSchema,
  type ChatConversation,
  type ChatContact,
  type ChatMessage,
} from "@/schemas/chat";

type AxiosErrorResponse = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      title?: string;
      errors?: Record<string, string[]>;
      [key: string]: unknown;
    };
  };
  message?: string;
};

function logApiError(context: string, error: unknown) {
  const err = error as AxiosErrorResponse;
  const data = err.response?.data;
  const status = err.response?.status;
  console.error(`[${context}] status: ${status ?? "N/A"}`);
  if (data) {
    console.error(`[${context}] message:`, data.message ?? data.error ?? "N/A");
  }
  console.error(`[${context}] raw error:`, err.message ?? error);
}

function unwrapBody(raw: unknown): unknown {
  if (raw && typeof raw === "object" && raw !== null && "data" in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function readField(
  record: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (key in record && record[key] != null) {
      return record[key];
    }
  }
  return undefined;
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/** REST uses Newtonsoft (PascalCase); normalize before Zod. */
function normalizeConversationRaw(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const o = item as Record<string, unknown>;
  const updatedAtRaw = readField(o, "updatedAt", "UpdatedAt");
  return {
    ...o,
    id: readField(o, "id", "Id"),
    title: readField(o, "title", "Title"),
    lastMessagePreview: readField(
      o,
      "lastMessagePreview",
      "LastMessagePreview",
    ),
    updatedAt:
      updatedAtRaw instanceof Date
        ? updatedAtRaw.toISOString()
        : updatedAtRaw,
    participantNames: readField(o, "participantNames", "ParticipantNames"),
    participantUserIds: readField(
      o,
      "participantUserIds",
      "ParticipantUserIds",
    ),
    unreadCount: coerceOptionalNumber(
      readField(o, "unreadCount", "UnreadCount"),
    ),
    groupType: readField(o, "groupType", "GroupType"),
    requestId: readField(o, "requestId", "RequestId"),
  };
}

function normalizeMessageRaw(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const o = item as Record<string, unknown>;
  const createdAtRaw = readField(o, "createdAt", "CreatedAt");
  return {
    ...o,
    id: readField(o, "id", "Id"),
    conversationId: readField(o, "conversationId", "ConversationId"),
    senderId: readField(o, "senderId", "SenderId"),
    senderName: readField(o, "senderName", "SenderName"),
    content: readField(o, "content", "Content"),
    createdAt:
      createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : createdAtRaw,
  };
}

function parseConversationList(raw: unknown): ChatConversation[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: ChatConversation[] = [];
  for (const item of arr) {
    const p = chatConversationSchema.safeParse(normalizeConversationRaw(item));
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseMessageList(raw: unknown): ChatMessage[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: ChatMessage[] = [];
  for (const item of arr) {
    const p = chatMessageSchema.safeParse(normalizeMessageRaw(item));
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseContactList(raw: unknown): ChatContact[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: ChatContact[] = [];
  for (const item of arr) {
    const p = chatContactSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseOnlineStatusList(raw: unknown): UserOnlineStatus[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: UserOnlineStatus[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const userIdRaw = readField(o, "userId", "UserId");
    const isOnlineRaw = readField(o, "isOnline", "IsOnline");
    if (userIdRaw == null) continue;
    out.push({
      userId: String(userIdRaw),
      isOnline: Boolean(isOnlineRaw),
    });
  }
  return out;
}

const getChatConversations = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}${CHAT_API_PATHS.conversations}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: parseConversationList(res.data) };
  } catch (error: unknown) {
    logApiError("getChatConversations", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to load conversations",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getChatContacts = async () => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}${CHAT_API_PATHS.contacts}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: parseContactList(res.data) };
  } catch (error: unknown) {
    logApiError("getChatContacts", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to load contacts",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getChatOnlineStatuses = async (userIds: string[]) => {
  const ids = userIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { data: [] as UserOnlineStatus[] };
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const params = new URLSearchParams();
    for (const id of ids) {
      params.append("userIds", id);
    }

    const res = await axios.get(
      `${process.env.BACK_END}${CHAT_API_PATHS.onlineStatus}?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: parseOnlineStatusList(res.data) };
  } catch (error: unknown) {
    logApiError("getChatOnlineStatuses", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to load online statuses",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

type GetMessagesOptions = { take?: number; before?: string };

const getChatMessages = async (
  conversationId: string,
  options?: GetMessagesOptions,
) => {
  try {
    if (!conversationId) {
      return { error: "Validation Error", message: "conversationId is required." };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const params = new URLSearchParams();
    if (options?.take != null) params.set("take", String(options.take));
    if (options?.before) params.set("before", options.before);
    const qs = params.toString();
    const url = `${process.env.BACK_END}${CHAT_API_PATHS.messages(conversationId)}${qs ? `?${qs}` : ""}`;

    const res = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return { data: parseMessageList(res.data) };
  } catch (error: unknown) {
    logApiError("getChatMessages", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to load messages",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const createChatConversation = async (participantUserIds: string[]) => {
  try {
    if (!participantUserIds?.length) {
      return {
        error: "Validation Error",
        message: "At least one participant is required.",
      };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.post(
      `${process.env.BACK_END}${CHAT_API_PATHS.createConversation}`,
      { participantUserIds },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    const raw = unwrapBody(res.data);
    const parsed = chatConversationSchema.safeParse(normalizeConversationRaw(raw));
    if (parsed.success) {
      return { data: parsed.data };
    }
    return { data: raw as ChatConversation };
  } catch (error: unknown) {
    logApiError("createChatConversation", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to create conversation",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const sendChatMessageRest = async (conversationId: string, content: string) => {
  try {
    if (!conversationId || !content?.trim()) {
      return {
        error: "Validation Error",
        message: "conversationId and content are required.",
      };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.post(
      `${process.env.BACK_END}${CHAT_API_PATHS.sendMessageRest}`,
      { conversationId, content: content.trim() },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    const raw = unwrapBody(res.data);
    const parsed = chatMessageSchema.safeParse(normalizeMessageRaw(raw));
    if (parsed.success) {
      return { data: parsed.data };
    }
    return { data: raw as ChatMessage | undefined };
  } catch (error: unknown) {
    logApiError("sendChatMessageRest", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to send message",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getRequestChatConversations = async (requestId: string) => {
  try {
    if (!requestId?.trim()) {
      return { error: "Validation Error", message: "requestId is required." };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}${CHAT_API_PATHS.requestConversations(requestId.trim())}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return { data: parseConversationList(res.data) };
  } catch (error: unknown) {
    logApiError("getRequestChatConversations", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to load request conversations",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const openRequestChatConversation = async (
  requestId: string,
  groupType: string,
) => {
  try {
    if (!requestId?.trim() || !groupType?.trim()) {
      return {
        error: "Validation Error",
        message: "requestId and groupType are required.",
      };
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}${CHAT_API_PATHS.requestConversations(requestId.trim(), groupType.trim())}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    const raw = unwrapBody(res.data);
    const parsed = chatConversationSchema.safeParse(normalizeConversationRaw(raw));
    if (parsed.success) {
      return { data: parsed.data };
    }
    return { data: raw as ChatConversation };
  } catch (error: unknown) {
    logApiError("openRequestChatConversation", error);
    const err = error as AxiosErrorResponse;
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    return {
      error: "Failed to open request conversation",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  getChatConversations,
  getChatContacts,
  getChatOnlineStatuses,
  getChatMessages,
  createChatConversation,
  sendChatMessageRest,
  getRequestChatConversations,
  openRequestChatConversation,
};
