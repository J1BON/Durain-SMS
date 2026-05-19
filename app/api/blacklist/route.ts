import { NextRequest, NextResponse } from "next/server";
import { DurianApiError, fetchDurian } from "@/lib/durian-api";

export async function POST(request: NextRequest) {
  let body: { pn?: string; pid?: number } = {};
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

  try {
    await fetchDurian("addBlack", { pn, pid });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DurianApiError) {
      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/blacklist]", err);
    return NextResponse.json(
      { error: "Failed to blacklist number" },
      { status: 500 },
    );
  }
}
