import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookieValue, SESSION_COOKIE } from "@/lib/site-auth";
import { getSettings } from "@/lib/site-settings";
import { parseStatsPeriod, resolveStatsSince } from "@/lib/stats-period";
import { getAllUsers } from "@/lib/users";
import {
  getAllUsersStats,
  getDailyUsersStats,
  getRecentActivity,
} from "@/lib/tracking";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(token);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = parseStatsPeriod(request.nextUrl.searchParams.get("period"));
  const { statsResetAt } = await getSettings();
  const since = resolveStatsSince(period, statsResetAt);

  const [allUsers, recent] = await Promise.all([
    getAllUsers(),
    getRecentActivity(100, since),
  ]);

  const regularUsers = allUsers.filter((u) => u.role === "user");
  const [stats, dailyStats] = await Promise.all([
    getAllUsersStats(regularUsers, since != null ? { since } : {}),
    period === "all"
      ? getDailyUsersStats(regularUsers, { days: 30 })
      : since != null
        ? getDailyUsersStats(regularUsers, { since })
        : getDailyUsersStats(regularUsers, { days: 30 }),
  ]);

  return NextResponse.json({
    users: allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      role: u.role,
    })),
    stats,
    dailyStats,
    period,
    statsResetAt,
    recent,
  });
}
