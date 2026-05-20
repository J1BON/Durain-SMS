import { NextRequest, NextResponse } from "next/server";
import { DurianApiError } from "@/lib/durian-api";
import { fetchDurianWithPnVariants } from "@/lib/durian-pn-action";

export async function POST(request: NextRequest) {
  let body: { pn?: string; pid?: number; serial?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const pnRaw = body.pn?.trim();
  const pid = body.pid;

  if (!pnRaw || !pid) {
    return NextResponse.json(
      { error: "pn and pid are required" },
      { status: 400 },
    );
  }

  const serial = body.serial === 1 ? 1 : 2;

  try {
    await fetchDurianWithPnVariants("passMobile", pnRaw, { pid, serial });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DurianApiError) {
      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/release]", err);
    return NextResponse.json(
      { error: "Failed to release number" },
      { status: 500 },
    );
  }
}
