import { NextRequest, NextResponse } from "next/server";
import {
  beginPanelSession,
  mergeJarFromResponseHeaders,
  refreshCaptchaInJar,
  type PanelCookies,
} from "@/lib/durian-panel";
import {
  PANEL_CHALLENGE_COOKIE,
  sealPanelChallengeJar,
  unsealPanelChallengeJar,
} from "@/lib/panel-challenge-cookie";

export const dynamic = "force-dynamic";

function cookieHeaderFromMap(cookies: PanelCookies): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function attachChallengeCookie(
  response: NextResponse,
  jar: PanelCookies,
): NextResponse {
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
}

export async function GET(request: NextRequest) {
  try {
    const reuse = request.nextUrl.searchParams.get("reuse") === "1";
    let jar: PanelCookies = {};

    if (reuse) {
      const existing = unsealPanelChallengeJar(
        request.cookies.get(PANEL_CHALLENGE_COOKIE)?.value,
      );
      if (existing && Object.keys(existing).length > 0) {
        jar = { ...existing };
      }
    }

    let buffer: ArrayBuffer;
    let contentType = "image/gif";

    if (reuse && Object.keys(jar).length > 0) {
      buffer = await refreshCaptchaInJar(jar);
    } else {
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
      contentType = res.headers.get("content-type") ?? "image/gif";
      buffer = await res.arrayBuffer();
    }

    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });

    return attachChallengeCookie(response, jar);
  } catch (err) {
    console.error("[api/panel/captcha]", err);
    return NextResponse.json(
      { error: "Failed to load captcha" },
      { status: 500 },
    );
  }
}
