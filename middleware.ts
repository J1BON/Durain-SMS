import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionCookieShape,
} from "@/lib/site-auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isCronSyncRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return request.nextUrl.searchParams.get("secret") === secret;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api/cron/sync") {
    if (isCronSyncRequest(request)) {
      return NextResponse.next();
    }
    const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim());
    return NextResponse.json(
      {
        error: hasCronSecret
          ? "Cron auth required. Use Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET> (same value as Render env CRON_SECRET)."
          : "CRON_SECRET is not set on the server. Add it in Render Environment, redeploy, then call this URL with ?secret= or Bearer.",
      },
      { status: 401 },
    );
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.has(pathname)
  ) {
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (verifySessionCookieShape(token)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionCookieShape(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminRoute && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
