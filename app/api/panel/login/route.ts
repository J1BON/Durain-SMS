import { NextRequest, NextResponse } from "next/server";
import { loginToPanel } from "@/lib/durian-panel";
import { getServices } from "@/lib/discover-services";

export const dynamic = "force-dynamic";

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

  try {
    await loginToPanel({ username, password, captcha });
    const result = await getServices({ forceRefresh: true });

    return NextResponse.json({
      ok: true,
      message: "Panel linked successfully",
      count: result.services.length,
    });
  } catch (err) {
    console.error("[api/panel/login]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Panel login failed",
      },
      { status: 400 },
    );
  }
}
