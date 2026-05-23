import { NextResponse } from "next/server";
import { getSettings } from "@/lib/site-settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ lock: settings.lock });
}
