import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cuyForDurianApi } from "@/lib/country-list";
import { DurianApiError, fetchDurian, parsePhoneData } from "@/lib/durian-api";
import { verifySessionCookieValue, SESSION_COOKIE } from "@/lib/site-auth";
import { recordNumberAssigned } from "@/lib/tracking";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const session = await verifySessionCookieValue(jar.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pid = request.nextUrl.searchParams.get("pid");
  const cuy = request.nextUrl.searchParams.get("cuy");
  const serialParam = request.nextUrl.searchParams.get("serial");
  const secretKey = request.nextUrl.searchParams.get("secret_key");
  const noblack = request.nextUrl.searchParams.get("noblack") ?? "0";

  if (!pid) {
    return NextResponse.json({ error: "pid is required" }, { status: 400 });
  }

  const serial = serialParam === "1" ? 1 : 2;

  try {
    const params: Record<string, string | number | undefined> = {
      pid,
      num: 1,
      noblack: Number(noblack) || 0,
      serial,
      secret_key: secretKey?.trim() || "null",
      vip: "null",
    };

    if (cuy && cuy !== "*" && cuy !== "all") {
      params.cuy = cuyForDurianApi(cuy);
    }

    const { data, raw } = await fetchDurian<string>("getMobile", params);
    const rawData =
      typeof data === "string" ? data : data != null ? String(data) : "";
    const apiPn = parsePhoneData(rawData);

    try {
      await recordNumberAssigned(
        session.userId,
        session.username,
        apiPn,
        pid,
        cuy ?? "any",
      );
    } catch {
      // tracking failure must not break the main flow
    }

    return NextResponse.json({
      phoneNumber: apiPn,
      apiPn,
      raw: raw.data,
    });
  } catch (err) {
    if (err instanceof DurianApiError) {
      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/getNumber]", err);
    return NextResponse.json(
      { error: "Failed to get phone number" },
      { status: 500 },
    );
  }
}
