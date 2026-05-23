import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookieValue, SESSION_COOKIE } from "@/lib/site-auth";
import { getAllUsers } from "@/lib/users";
import { getAllUsersStats, getRecentActivity } from "@/lib/tracking";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookieValue(token);

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [allUsers, recent] = await Promise.all([
    getAllUsers(),
    getRecentActivity(100),
  ]);

  const regularUsers = allUsers.filter((u) => u.role === "user");
  const stats = await getAllUsersStats(regularUsers);

  return NextResponse.json({
    users: allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      role: u.role,
    })),
    stats,
    recent,
  });
}
