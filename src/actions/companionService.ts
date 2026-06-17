"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

type Payload = Record<string, unknown>;

type RequestOptions = {
  /**
   * Sent as the `UserId` request header.
   * - Registration: new account id before login.
   * - Housing leader: `RequestDto.UserId` (request owner), never the logged-in leader id.
   * - Omit only when the logged-in user loads their own companions (token scope).
   */
  userId?: string;
};

const BASE = "Companions";

function mapAxiosCompanionError(error: unknown): {
  error: string;
  message: string;
} {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  if (err.response?.status === 401) {
    return {
      error: "Unauthorized",
      message:
        err.response?.data?.message ||
        "Authentication failed. Please login again.",
    };
  }
  return {
    error: "Request Failed",
    message:
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred",
  };
}

/**
 * `CompanionsController` add/update use `[FromForm] AddCompanionDto` (includes `DocumentImage`).
 * Do not set `Content-Type` manually so the client sets multipart boundaries.
 */
async function requestMultipart(
  method: "post" | "put",
  url: string,
  formData: FormData,
  options?: RequestOptions,
) {
  const accessToken = await getAccessToken();
  const scopedUserId = options?.userId?.trim();

  if (!accessToken && !scopedUserId) {
    return {
      error: "Unauthorized",
      message:
        "No access token found. Pass userId from registration when calling companions API before login.",
    };
  }

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (scopedUserId) {
    headers.UserId = scopedUserId;
  }

  try {
    const res = await axios[method](url, formData, {
      headers,
      withCredentials: true,
    });
    return toPlainSerializable(res.data);
  } catch (error: unknown) {
    return mapAxiosCompanionError(error);
  }
}

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  options?: RequestOptions,
) {
  const accessToken = await getAccessToken();
  const scopedUserId = options?.userId?.trim();

  if (!accessToken && !scopedUserId) {
    return {
      error: "Unauthorized",
      message:
        "No access token found. Pass userId from registration when calling companions API before login.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (scopedUserId) {
    headers.UserId = scopedUserId;
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
    return mapAxiosCompanionError(error);
  }
}

/**
 * `Companions/getAll`.
 * @param userId Request owner's `UserId` (`RequestDto.UserId`). Required when a leader
 *   views another user's request. Omit only for the logged-in user's own companions.
 */
const getCompanions = async (userId?: string) => {
  const trimmed = userId?.trim();
  return request(
    "get",
    `${process.env.BACK_END}/${BASE}/getAll`,
    undefined,
    trimmed ? { userId: trimmed } : undefined,
  );
};

/** Leader / housing sender: always pass `RequestDto.UserId`, never localStorage viewer id. */
const getCompanionsForRequestOwner = async (requestUserId: string) => {
  const trimmed = requestUserId.trim();
  if (!trimmed) {
    return {
      error: "BadRequest",
      message: "معرّف صاحب الطلب (UserId) مطلوب لتحميل المرافقين.",
    };
  }
  return getCompanions(trimmed);
};

const getCompanionById = async (id: string, userId?: string) =>
  id === "new"
    ? null
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`, undefined, {
        userId,
      });

const getCompanionsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);

/** `[FromForm] AddCompanionDto` — include `DocumentImage` for new companions (API requirement). */
const addCompanion = async (formData: FormData, userId?: string) =>
  requestMultipart("post", `${process.env.BACK_END}/${BASE}/add`, formData, {
    userId,
  });

/** `[FromForm] AddCompanionDto` — omit `DocumentImage` to keep the existing document. */
const updateCompanionById = async (formData: FormData, userId?: string) =>
  requestMultipart("put", `${process.env.BACK_END}/${BASE}/update`, formData, {
    userId,
  });

const deleteCompanionById = async (id: string, userId?: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`, undefined, {
    userId,
  });

const softDeleteCompanionById = async (id: string, userId?: string) =>
  request(
    "delete",
    `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`,
    undefined,
    { userId },
  );

function extractDocumentUrlFromUpload(response: unknown): string | undefined {
  if (!response || typeof response !== "object") return undefined;
  const o = response as Record<string, unknown>;
  const payload = o.result ?? o.Result ?? o.data ?? o.Data;
  if (typeof payload === "string" && payload.trim()) {
    const t = payload.trim();
    if (t.includes("Attach/") || t.length <= 140) return t;
  }
  if (payload && typeof payload === "object") {
    const inner = payload as Record<string, unknown>;
    const url =
      inner.url ??
      inner.Url ??
      inner.documentImageUrl ??
      inner.DocumentImageUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return undefined;
}

/** Upload companion identity file during registration (before login). */
const uploadCompanionIdentityFile = async (
  formData: FormData,
  userId: string,
) => {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "BadRequest", message: "ملف المستند مطلوب" };
  }

  const uploadData = new FormData();
  uploadData.append("File", file);
  uploadData.append("AttachFolder", "Companions");

  const accessToken = await getAccessToken();
  const headers: Record<string, string> = { UserId: userId.trim() };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    delete headers.UserId;
  }

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/Attachments/add`,
      uploadData,
      { headers, withCredentials: true },
    );
    const url = extractDocumentUrlFromUpload(res.data);
    if (url) return { documentImageUrl: url };
  } catch {
    // Attachments API may be unavailable; fall back to path convention.
  }

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".jpg";
  const fallback = `Attach/Companions/${Date.now()}${ext}`;
  return { documentImageUrl: fallback.slice(0, 140) };
};

export {
  addCompanion,
  deleteCompanionById,
  getCompanionById,
  getCompanions,
  getCompanionsForRequestOwner,
  getCompanionsPaged,
  softDeleteCompanionById,
  updateCompanionById,
  uploadCompanionIdentityFile,
};
