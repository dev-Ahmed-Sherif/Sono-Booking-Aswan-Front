"use client";

async function postMultipartApi(
  url: string,
  formData: FormData,
  fallbackMessage: string,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    return {
      error: data.error ?? "Request Failed",
      message: data.message ?? fallbackMessage,
      status: res.status,
    };
  }

  return data;
}

/** Submit `Requests/add` multipart when the body includes file attachments. */
export async function submitAddRequestFormData(
  formData: FormData,
): Promise<unknown> {
  return postMultipartApi(
    "/api/requests/add",
    formData,
    "فشل تقديم الطلب",
  );
}

/** Submit `Requests/update` multipart when the body includes file attachments. */
export async function submitUpdateRequestFormData(
  formData: FormData,
): Promise<unknown> {
  return postMultipartApi(
    "/api/requests/update",
    formData,
    "فشل تحديث الطلب",
  );
}
