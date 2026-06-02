import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/token-helper";
import { runAccountUpdatePut } from "@/lib/account-update-remote";

/**
 * Account profile update without Server Actions (avoids Next.js RSC
 * serialization limits on `File` / multipart).
 */
export async function POST(req: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
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

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      const result = await runAccountUpdatePut({
        apiBase,
        accessToken,
        data: body,
      });
      if ("error" in result) {
        const status =
          result.error === "Unauthorized"
            ? 401
            : result.error === "Not Found"
              ? 404
              : result.error === "Conflict"
                ? 409
                : result.error === "Server Error"
                  ? 500
                  : 400;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json(result);
    }

    const fd = await req.formData();
    const payloadRaw = fd.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json(
        { error: "BadRequest", message: "حقل payload (JSON) مطلوب" },
        { status: 400 },
      );
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "BadRequest", message: "payload غير صالح" },
        { status: 400 },
      );
    }

    const image = fd.get("DocumentImage") ?? fd.get("Image");
    const identityFile =
      image instanceof File && image.size > 0 ? image : undefined;

    const result = await runAccountUpdatePut({
      apiBase,
      accessToken,
      data: body,
      identityAttachmentArg: identityFile,
    });

    if ("error" in result) {
      const status =
        result.error === "Unauthorized"
          ? 401
          : result.error === "Not Found"
            ? 404
            : result.error === "Conflict"
              ? 409
              : result.error === "Server Error"
                ? 500
                : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to update user", message: "حدث خطأ أثناء المعالجة" },
      { status: 500 },
    );
  }
}
