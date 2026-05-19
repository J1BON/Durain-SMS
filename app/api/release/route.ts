import { NextRequest, NextResponse } from "next/server";
import { DurianApiError, fetchDurian } from "@/lib/durian-api";

export async function POST(request: NextRequest) {
  let body: { pn?: string; pid?: number; serial?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const pn = body.pn?.trim();
  const pid = body.pid;

  if (!pn || !pid) {
    return NextResponse.json(
      { error: "pn and pid are required" },
      { status: 400 },
    );
  }

  const serial = body.serial === 1 ? 1 : 2;

  try {
    await fetchDurian("passMobile", { pn, pid, serial });
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
