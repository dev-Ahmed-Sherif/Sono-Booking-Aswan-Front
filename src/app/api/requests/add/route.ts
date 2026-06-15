import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/lib/token-helper";
import { relayFormDataEntriesAsync } from "@/lib/form-data-relay";
import { runRequestAddPost } from "@/lib/request-add-remote";

/**
 * New-stay request submit with optional attachments.
 * Server Actions do not reliably forward file blobs in multipart FormData.
 */
export async function POST(req: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
      },
      { status: 401 },
    );
  }

  const apiBase = process.env.BACK_END ?? process.env.BACK_END_DEV ?? "";
  if (!apiBase) {
    return NextResponse.json(
      {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      },
      { status: 500 },
    );
  }

  try {
    const incoming = await req.formData();
    const formData = await relayFormDataEntriesAsync(incoming);
    const result = await runRequestAddPost({
      apiBase,
      accessToken,
      formData,
    });

    if ("error" in result) {
      const status = result.error === "Unauthorized" ? 401 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: "Request Failed",
        message: "حدث خطأ أثناء تقديم الطلب.",
      },
      { status: 500 },
    );
  }
}
