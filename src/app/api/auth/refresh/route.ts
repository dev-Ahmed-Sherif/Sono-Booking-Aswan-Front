import { NextResponse } from "next/server";

import { refreshAccessTokenOnce } from "@/lib/refresh-access-token";

/** Refreshes the httpOnly access token and returns a new refresh token for the client cookie. */
export async function POST() {
  const result = await refreshAccessTokenOnce();

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    refreshToken: result.refreshToken,
  });
}
