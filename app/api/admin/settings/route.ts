import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookieValue, SESSION_COOKIE } from "@/lib/site-auth";
import { getSettings, saveSettings, type LockedSetting } from "@/lib/site-settings";

async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getSettings());
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { lock: LockedSetting | null };

  if (body.lock !== null) {
    const { pid, name, country } = body.lock;
    if (!pid || !name || !country) {
      return NextResponse.json(
        { error: "lock must have pid, name, and country" },
        { status: 400 },
      );
    }
  }

  await saveSettings({ lock: body.lock ?? null });
  return NextResponse.json({ ok: true });
}
