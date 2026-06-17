"use server";

import axios from "@/lib/axios-auth";
import { getUserData } from "@/actions/auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

type Payload = Record<string, unknown>;

type RequestOptions = {
  /** Sent as the `UserId` request header (`ExtensionsController.GetAllAsync`). */
  userId?: string;
};

const BASE = "Extensions";

async function resolveUserId(userId?: string): Promise<string | undefined> {
  const trimmed = userId?.trim();
  if (trimmed) return trimmed;

  const result = await getUserData();
  if (result && typeof result === "object" && "error" in result) {
    return undefined;
  }

  const data = (result as { data?: { data?: Record<string, unknown> } })?.data
    ?.data;
  if (!data || typeof data !== "object") return undefined;

  const resolved = String(data.id ?? data.Id ?? "").trim();
  return resolved || undefined;
}

function mapAxiosExtensionError(error: unknown): {
  error: string;
  message: string;
} {
  const err = error as {
    response?: { status?: number; data?: { message?: string; Message?: string } };
    message?: string;
  };
  if (err.response?.status === 401) {
    return {
      error: "Unauthorized",
      message:
        err.response?.data?.message ||
        err.response?.data?.Message ||
        "يرجى تسجيل الدخول مرة أخرى.",
    };
  }
  return {
    error: "Request Failed",
    message:
      err.response?.data?.message ||
      err.response?.data?.Message ||
      err.message ||
      "حدث خطأ غير متوقع",
  };
}

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  options?: RequestOptions,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const resolvedUserId = options?.userId?.trim();
  if (resolvedUserId) {
    headers.UserId = resolvedUserId;
  }

  const config = {
    headers,
    withCredentials: true,
  };

  try {
    if (method === "get" || method === "delete") {
      return toPlainSerializable((await axios[method](url, config)).data);
    }
    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    return mapAxiosExtensionError(error);
  }
}

const getExtensions = async (userId?: string) => {
  const resolvedUserId = await resolveUserId(userId);
  return request("get", `${process.env.BACK_END}/${BASE}/getAll`, undefined, {
    userId: resolvedUserId,
  });
};

/** All extensions for leader / housing sender (no `UserId` header). */
const getAllExtensions = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getExtensionById = async (id: string) =>
  id === "new"
    ? null
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getExtensionsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getExtensionsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addExtension = async (data: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateExtensionById = async (data: Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteExtensionById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteExtensionById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addExtension,
  deleteExtensionById,
  getAllExtensions,
  getExtensionById,
  getExtensions,
  getExtensionsDropDown,
  getExtensionsPaged,
  softDeleteExtensionById,
  updateExtensionById,
};
