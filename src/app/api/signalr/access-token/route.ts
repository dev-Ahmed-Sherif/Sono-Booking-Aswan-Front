import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieName = process.env.ACCESS_TOKEN_COOKIE;
  if (!cookieName) {
    return NextResponse.json(
      { error: "Server misconfiguration", message: "ACCESS_TOKEN_COOKIE is not set" },
      { status: 500 },
    );
  }

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
