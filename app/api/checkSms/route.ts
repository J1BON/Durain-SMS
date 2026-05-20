import { NextRequest, NextResponse } from "next/server";
import { DurianApiError, fetchDurian, isDurianSmsStillWaiting } from "@/lib/durian-api";
import { pnVariantsForDurianMsg } from "@/lib/durian-phone";

export const dynamic = "force-dynamic";

function extractSmsCode(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (data != null) return String(data).trim();
  return "";
}

export async function GET(request: NextRequest) {
  const pnRaw = request.nextUrl.searchParams.get("pn");
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pnRaw || !pid) {
    return NextResponse.json(
      { error: "pn and pid are required" },
      { status: 400 },
    );
  }

  const serialParam = request.nextUrl.searchParams.get("serial") ?? "2";
  const primarySerial = serialParam === "1" ? 1 : 2;
  const serialsToTry: (1 | 2)[] =
    primarySerial === 1 ? [1, 2] : [2, 1];

  const variants = pnVariantsForDurianMsg(pnRaw);
  let lastPending: string | null = null;
  let lastError: DurianApiError | null = null;

  for (const pn of variants) {
    for (const serial of serialsToTry) {
      try {
        const { data } = await fetchDurian<string>("getMsg", {
          pn,
          pid,
          serial,
        });
        const code = extractSmsCode(data);

        if (code) {
          return NextResponse.json({ code, pending: false, serial });
        }

        lastPending = "SMS not received yet";
      } catch (err) {
        if (err instanceof DurianApiError) {
          if (isDurianSmsStillWaiting(err.apiCode, err.message)) {
            lastPending = err.message;
            continue;
          }
          if (err.apiCode === 905) {
            lastError = err;
            continue;
          }
          return NextResponse.json(
            { error: err.message, code: err.apiCode },
            { status: err.httpStatus },
          );
        }
        console.error("[api/checkSms]", err);
        return NextResponse.json(
          { error: "Failed to check SMS" },
          { status: 500 },
        );
      }
    }
  }

  if (lastPending) {
    return NextResponse.json(
      { pending: true, message: lastPending },
      { status: 202 },
    );
  }

  if (lastError) {
    return NextResponse.json(
      { error: lastError.message, code: lastError.apiCode },
      { status: lastError.httpStatus },
    );
  }

  return NextResponse.json(
    { pending: true, message: "SMS not received yet" },
    { status: 202 },
  );
}
