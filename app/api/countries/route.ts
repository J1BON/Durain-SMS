import { NextRequest, NextResponse } from "next/server";
import {
  DurianApiError,
  fetchDurian,
  type CountryStock,
} from "@/lib/durian-api";
import { parseDurianCountryStock } from "@/lib/durian-countries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid");

  if (!pid) {
    return NextResponse.json(
      { error: "pid (project ID) is required" },
      { status: 400 },
    );
  }

  try {
    const { data } = await fetchDurian<CountryStock>("getCountryPhoneNum", {
      pid,
    });

    const countries = parseDurianCountryStock(data);

    return NextResponse.json({
      countries,
      source: "durian",
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof DurianApiError) {
      if (err.apiCode === 403) {
        return NextResponse.json({
          countries: [],
          source: "durian",
          updatedAt: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        { error: err.message, code: err.apiCode },
        { status: err.httpStatus },
      );
    }

    console.error("[api/countries]", err);
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 },
    );
  }
}
