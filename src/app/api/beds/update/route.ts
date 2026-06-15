import { NextRequest, NextResponse } from "next/server";

import { runBedUpdatePut } from "@/lib/bed-multipart-remote";
import { relayFormDataEntries } from "@/lib/form-data-relay";
import { getAccessToken } from "@/lib/token-helper";

/**
 * Bed update with optional image uploads.
 * Server Actions do not reliably forward file blobs in multipart FormData.
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
        message: "Backend URL is not configured (BACK_END).",
      },
      { status: 500 },
    );
  }

  try {
    const incoming = await req.formData();
    const formData = relayFormDataEntries(incoming);
    const result = await runBedUpdatePut({
      apiBase,
      accessToken,
      formData,
    });

    if (result && typeof result === "object" && "error" in result) {
      const status =
        (result as { error?: string }).error === "Unauthorized" ? 401 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: "Request Failed",
        message: "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
