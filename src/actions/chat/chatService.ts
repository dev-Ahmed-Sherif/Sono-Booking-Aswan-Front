"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import {
  CHAT_API_PATHS,
} from "@/actions/chat/chatApi.contract";
import {
  chatConversationSchema,
  chatMessageSchema,
  type ChatConversation,
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

function parseConversationList(raw: unknown): ChatConversation[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: ChatConversation[] = [];
  for (const item of arr) {
    const p = chatConversationSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

function parseMessageList(raw: unknown): ChatMessage[] {
  const inner = unwrapBody(raw);
  const arr = Array.isArray(inner) ? inner : [];
  const out: ChatMessage[] = [];
  for (const item of arr) {
    const p = chatMessageSchema.safeParse(item);
    if (p.success) out.push(p.data);
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
    const parsed = chatConversationSchema.safeParse(raw);
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
    const parsed = chatMessageSchema.safeParse(raw);
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

export {
  getChatConversations,
  getChatMessages,
  createChatConversation,
  sendChatMessageRest,
};
