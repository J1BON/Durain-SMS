import { NextRequest, NextResponse } from "next/server";
import { runDurianSyncScript } from "@/lib/run-durian-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow long panel sync on hosts that support it (e.g. Render). */
export const maxDuration = 300;

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const force =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  try {
    const { exitCode, stdout, stderr } = await runDurianSyncScript({
      force,
      quiet: true,
    });

    if (exitCode !== 0) {
      return NextResponse.json(
        {
          ok: false,
          exitCode,
          error: stderr.trim() || stdout.trim() || "Sync script failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Durian catalog sync finished",
      log: stdout.trim() || undefined,
    });
  } catch (err) {
    console.error("[api/cron/sync]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
