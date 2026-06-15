"use client";

/**
 * Submit `Beds/update` multipart when the body includes new image uploads.
 * Server Actions drop file blobs in multipart FormData.
 */
export async function submitUpdateBedFormData(
  formData: FormData,
): Promise<unknown> {
  const res = await fetch("/api/beds/update", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      error: (data as { error?: string })?.error ?? "Request Failed",
      message:
        (data as { message?: string })?.message ??
        "تعذر حفظ بيانات السرير",
      status: res.status,
    };
  }

  return data;
}
