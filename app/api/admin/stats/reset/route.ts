import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookieValue, SESSION_COOKIE } from "@/lib/site-auth";
import { setStatsResetAt } from "@/lib/site-settings";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(token);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const at = Date.now();
  await setStatsResetAt(at);
  return NextResponse.json({ ok: true, statsResetAt: at });
}
