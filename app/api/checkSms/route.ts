import { NextRequest, NextResponse } from "next/server";
import { phoneForDurianExtApi } from "@/lib/format";
import { DurianApiError, fetchDurian } from "@/lib/durian-api";

export async function GET(request: NextRequest) {
  const pnRaw = request.nextUrl.searchParams.get("pn");
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pnRaw || !pid) {
    return NextResponse.json(
      { error: "pn and pid are required" },
      { status: 400 },
    );
  }

  const pn = phoneForDurianExtApi(pnRaw);

  try {
    const serial = request.nextUrl.searchParams.get("serial") ?? "2";
    const { data } = await fetchDurian<string>("getMsg", { pn, pid, serial });
    const code =
      typeof data === "string"
        ? data.trim()
        : data != null
          ? String(data).trim()
          : "";

    if (!code) {
      return NextResponse.json(
        { pending: true, message: "SMS not received yet" },
        { status: 202 },
      );
    }

    return NextResponse.json({ code, pending: false });
  } catch (err) {
    if (err instanceof DurianApiError) {
      if (err.apiCode === 908) {
        return NextResponse.json(
          { pending: true, message: err.message },
          { status: 202 },
        );
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
