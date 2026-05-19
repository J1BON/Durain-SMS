import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  getSiteCredentials,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  verifySiteLogin,
} from "@/lib/site-auth";

export async function POST(request: NextRequest) {
  if (!getSiteCredentials()) {
    return NextResponse.json(
      {
        error:
          "Site login is not configured. Set SITE_AUTH_USERNAME and SITE_AUTH_PASSWORD in .env.local",
      },
      { status: 500 },
    );
  }

  let body: { username?: string; password?: string } = {};
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    body = {};
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  if (!verifySiteLogin(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username });
  response.cookies.set(SESSION_COOKIE, await createSessionCookieValue(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return response;
}
