import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/discover-services";
import { DurianApiError } from "@/lib/durian-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const forceRefresh =
    request.nextUrl.searchParams.get("refresh") === "1" ||
    request.nextUrl.searchParams.get("refresh") === "true";

  try {
    const { services, cached, updatedAt, source, refreshing, setupHint } =
      await getServices({
        forceRefresh,
      });

    return NextResponse.json({
      services,
      count: services.length,
      cached,
      updatedAt,
      source,
      refreshing: refreshing ?? false,
      setupHint: services.length === 0 ? setupHint : undefined,
    });
  } catch (err) {
    if (err instanceof DurianApiError) {
      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/services]", err);
    return NextResponse.json(
      { error: "Failed to load services from DurianRCS" },
      { status: 500 },
    );
  }
}
