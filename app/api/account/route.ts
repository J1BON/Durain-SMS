import { NextResponse } from "next/server";
import { DurianApiError, fetchDurian } from "@/lib/durian-api";

export const dynamic = "force-dynamic";

type UserInfo = {
  score?: number;
  balance?: number;
  points?: number;
  username?: string;
  [key: string]: unknown;
};

export async function GET() {
  try {
    const { data } = await fetchDurian<UserInfo | string>("getUserInfo", {});

    if (typeof data === "string" || typeof data === "number") {
      const balance = Number(data);
      if (!Number.isFinite(balance)) {
        return NextResponse.json(
          { error: "Invalid balance from Durian" },
          { status: 502 },
        );
      }
      return NextResponse.json({
        balance,
        source: "durian",
        updatedAt: new Date().toISOString(),
      });
    }

    const balance =
      typeof data?.score === "number"
        ? data.score
        : typeof data?.balance === "number"
          ? data.balance
          : typeof data?.points === "number"
            ? data.points
            : null;

    if (balance === null || !Number.isFinite(balance)) {
      return NextResponse.json(
        { error: "Balance not found in Durian response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      balance,
      username: typeof data?.username === "string" ? data.username : undefined,
      source: "durian",
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof DurianApiError) {
      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/account]", err);
    return NextResponse.json(
      { error: "Failed to load account balance" },
      { status: 500 },
    );
  }
}
