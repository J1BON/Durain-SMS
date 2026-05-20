import { NextResponse } from "next/server";
import {
  beginPanelSession,
  mergeJarFromResponseHeaders,
  type PanelCookies,
} from "@/lib/durian-panel";
import {
  PANEL_CHALLENGE_COOKIE,
  sealPanelChallengeJar,
} from "@/lib/panel-challenge-cookie";

export const dynamic = "force-dynamic";

function cookieHeaderFromMap(cookies: PanelCookies): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export async function GET() {
  try {
    const jar: PanelCookies = {};
    await beginPanelSession(jar);

    const res = await fetch("https://mm.durianrcs.com/valdatioCode", {
      headers: { Cookie: cookieHeaderFromMap(jar) },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load captcha" },
        { status: 502 },
      );
    }

    mergeJarFromResponseHeaders(jar, res.headers);

    const buffer = await res.arrayBuffer();
    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/gif",
        "Cache-Control": "no-store",
      },
    });

    const sealed = sealPanelChallengeJar(jar);
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(PANEL_CHALLENGE_COOKIE, sealed, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 12 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[api/panel/captcha]", err);
    return NextResponse.json(
      { error: "Failed to load captcha" },
      { status: 500 },
    );
  }
}
