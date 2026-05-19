import { NextResponse } from "next/server";
import { beginPanelSession } from "@/lib/durian-panel";
import type { PanelCookies } from "@/lib/durian-panel";

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

    const buffer = await res.arrayBuffer();
    const setCookie = res.headers.get("set-cookie");

    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/gif",
        "Cache-Control": "no-store",
      },
    });

    if (setCookie) {
      response.headers.set("x-panel-set-cookie", setCookie);
    }

    return response;
  } catch (err) {
    console.error("[api/panel/captcha]", err);
    return NextResponse.json(
      { error: "Failed to load captcha" },
      { status: 500 },
    );
  }
}
