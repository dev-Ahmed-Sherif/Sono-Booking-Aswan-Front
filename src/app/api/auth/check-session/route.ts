import { NextResponse } from "next/server";

import { shouldRefreshToken } from "@/lib/jwt-utils";
import { getAccessToken } from "@/lib/token-helper";

/** Reports whether the session is active and the access token should be refreshed soon. */
export async function GET() {
  const accessToken = await getAccessToken();

  if (!accessToken?.trim()) {
    return NextResponse.json({ authenticated: false, shouldRefresh: false });
  }

  return NextResponse.json({
    authenticated: true,
    shouldRefresh: shouldRefreshToken(accessToken),
  });
}
