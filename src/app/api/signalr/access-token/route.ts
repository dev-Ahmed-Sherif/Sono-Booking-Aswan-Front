import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { accessTokenCookieName } from "@/lib/auth-cookies";

export async function GET() {
  const cookieName = accessTokenCookieName();
  const store = await cookies();
  const token = store.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", message: "No access token" },
      { status: 401 },
    );
  }

  return NextResponse.json({ accessToken: token });
}
