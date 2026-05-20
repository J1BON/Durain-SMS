import { NextRequest, NextResponse } from "next/server";
import {
  completePanelLoginWithJar,
  type PanelCookies,
} from "@/lib/durian-panel";
import { getServices } from "@/lib/discover-services";
import {
  PANEL_CHALLENGE_COOKIE,
  unsealPanelChallengeJar,
} from "@/lib/panel-challenge-cookie";

export const dynamic = "force-dynamic";

function jsonWithClearedChallenge(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  const res = NextResponse.json(body, { status });
  res.cookies.delete(PANEL_CHALLENGE_COOKIE);
  return res;
}

export async function POST(request: NextRequest) {
  const username = process.env.DURIAN_USERNAME;

  let body: { captcha?: string; password?: string } = {};
  try {
    body = (await request.json()) as { captcha?: string; password?: string };
  } catch {
    body = {};
  }

  const password = process.env.DURIAN_WEB_PASSWORD ?? body.password?.trim();
  const captcha = body.captcha?.trim();

  if (!username) {
    return NextResponse.json(
      { error: "DURIAN_USERNAME is not configured" },
      { status: 500 },
    );
  }

  if (!password) {
    return NextResponse.json(
      {
        error:
          "Set DURIAN_WEB_PASSWORD in .env.local or send password in the request body",
      },
      { status: 400 },
    );
  }

  if (!captcha) {
    return NextResponse.json({ error: "captcha is required" }, { status: 400 });
  }

  const challenge = request.cookies.get(PANEL_CHALLENGE_COOKIE)?.value;
  const jarFromBrowser = unsealPanelChallengeJar(challenge);

  if (!jarFromBrowser) {
    return jsonWithClearedChallenge(
      {
        error:
          "Captcha session missing or expired. Open Panel login, load a fresh image, then try again.",
      },
      400,
    );
  }

  try {
    await completePanelLoginWithJar({
      jar: jarFromBrowser as PanelCookies,
      username,
      password,
      captcha,
    });

    const result = await getServices({ forceRefresh: true });

    return jsonWithClearedChallenge(
      {
        ok: true,
        message: "Panel linked successfully",
        count: result.services.length,
      },
      200,
    );
  } catch (err) {
    console.error("[api/panel/login]", err);
    return jsonWithClearedChallenge(
      {
        error: err instanceof Error ? err.message : "Panel login failed",
      },
      400,
    );
  }
}
