import { NextResponse } from "next/server";

import { setAccessToken } from "@/lib/token-helper";

/** Persists httpOnly access token so middleware sees it on the next navigation. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { accessToken?: string };
    const accessToken = body.accessToken?.trim();
    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 },
      );
    }

    await setAccessToken(accessToken);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to set session" },
      { status: 500 },
    );
  }
}
