import { NextRequest, NextResponse } from "next/server";
import { pnVariantsForDurianMsg } from "@/lib/durian-phone";
import { DurianApiError, fetchDurian } from "@/lib/durian-api";

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

  const serial = request.nextUrl.searchParams.get("serial") ?? "2";
  const variants = pnVariantsForDurianMsg(pnRaw);
  let last908: string | null = null;
  let lastError: DurianApiError | null = null;

  for (const pn of variants) {
    try {
      const { data } = await fetchDurian<string>("getMsg", { pn, pid, serial });
      const code = extractSmsCode(data);

      if (code) {
        return NextResponse.json({ code, pending: false });
      }

      last908 = "SMS not received yet";
    } catch (err) {
      if (err instanceof DurianApiError) {
        if (err.apiCode === 908) {
          last908 = err.message;
          continue;
        }
        /** Wrong phone format for this session — try next variant. */
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

  if (last908) {
    return NextResponse.json(
      { pending: true, message: last908 },
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
