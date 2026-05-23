import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValue,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
} from "@/lib/site-auth";
import { findUserByCredentials } from "@/lib/users";

export async function POST(request: NextRequest) {
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

  let user;
  try {
    user = await findUserByCredentials(username, password);
  } catch (e) {
    console.error("[api/auth/login]", e);
    return NextResponse.json(
      {
        error:
          "Login database unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_KEY, then run supabase/schema.sql.",
      },
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    username: user.username,
    role: user.role,
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionCookieValue(user.username, user.id, user.role),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    },
  );

  return response;
}
