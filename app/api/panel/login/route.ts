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
export const maxDuration = 60;

function panelLoginJson(
  body: Record<string, unknown>,
  status: number,
  options?: { clearChallenge?: boolean },
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (options?.clearChallenge) {
    res.cookies.delete(PANEL_CHALLENGE_COOKIE);
  }
  return res;
}

function isInvalidCaptchaError(message: string): boolean {
  return /invalid captcha/i.test(message);
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
    return panelLoginJson(
      {
        error:
          "Captcha session missing or expired. Wait for the image to finish loading, then try again.",
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

    const cached = await getServices({ forceRefresh: false });
    void getServices({ forceRefresh: true }).catch((syncErr) => {
      console.error("[api/panel/login] background catalog sync:", syncErr);
    });

    return panelLoginJson(
      {
        ok: true,
        message:
          cached.services.length > 0
            ? "Panel linked. Service catalog is syncing in the background."
            : "Panel linked. Tap Sync services on the home page (may take 1–2 minutes).",
        count: cached.services.length,
        syncing: true,
      },
      200,
      { clearChallenge: true },
    );
  } catch (err) {
    console.error("[api/panel/login]", err);
    const message = err instanceof Error ? err.message : "Panel login failed";
    const invalidCaptcha = isInvalidCaptchaError(message);
    return panelLoginJson(
      {
        error: message,
        refreshCaptcha: invalidCaptcha,
      },
      400,
      { clearChallenge: !invalidCaptcha },
    );
  }
}
