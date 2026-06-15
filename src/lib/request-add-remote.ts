import { toPlainSerializable } from "@/lib/to-plain-serializable";

function extractMessageFromApiBody(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const direct = d.message ?? d.Message ?? d.title ?? d.Title;
  if (direct != null && String(direct).trim()) return String(direct).trim();

  const errors = d.errors ?? d.Errors;
  if (errors && typeof errors === "object") {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(
      errors as Record<string, unknown>,
    )) {
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        const text = String(item ?? "").trim();
        if (text) parts.push(field ? `${field}: ${text}` : text);
      }
    }
    if (parts.length > 0) return parts.join(" · ");
  }

  return undefined;
}

function mapMultipartError(
  status: number,
  data: unknown,
  fallback: string,
): { error: string; message: string } {
  const bodyMessage = extractMessageFromApiBody(data);
  if (status === 401) {
    return {
      error: "Unauthorized",
      message: bodyMessage || "يرجى تسجيل الدخول مرة أخرى.",
    };
  }
  return {
    error: "Request Failed",
    message: bodyMessage || fallback,
  };
}

/**
 * POST/PUT multipart to `Requests/add` or `Requests/update` ([FromForm] AddRequestDto).
 * Uses native fetch so FormData file parts are preserved (axios in Node often drops them).
 */
export async function runRequestMultipart(
  method: "post" | "put",
  options: {
    apiBase: string;
    accessToken: string;
    formData: FormData;
  },
): Promise<Record<string, unknown>> {
  const { apiBase, accessToken, formData } = options;
  const path = method === "post" ? "Requests/add" : "Requests/update";
  const url = `${apiBase.replace(/\/$/, "")}/${path}`;

  try {
    const response = await fetch(url, {
      method: method === "post" ? "POST" : "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const raw = await response.text();
    let data: unknown = null;
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    if (!response.ok) {
      return mapMultipartError(
        response.status,
        data,
        method === "post" ? "فشل تقديم الطلب" : "فشل تحديث الطلب",
      );
    }

    return toPlainSerializable(data) as Record<string, unknown>;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return {
      error: "Request Failed",
      message,
    };
  }
}

export async function runRequestAddPost(options: {
  apiBase: string;
  accessToken: string;
  formData: FormData;
}): Promise<Record<string, unknown>> {
  return runRequestMultipart("post", options);
}

export async function runRequestUpdatePut(options: {
  apiBase: string;
  accessToken: string;
  formData: FormData;
}): Promise<Record<string, unknown>> {
  return runRequestMultipart("put", options);
}
