import { NextResponse } from "next/server";
import { syncServicesCatalogFromPanel } from "@/lib/sync-services-catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await syncServicesCatalogFromPanel();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Sync failed",
        count: 0,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    count: result.count,
    message: `Synced ${result.count} services from Durian`,
  });
}
