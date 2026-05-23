import { getSupabase } from "./supabase";

export type UserRole = "user" | "admin";

export interface SiteUser {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

export const MAX_WORKER_ACCOUNTS = 10;

const DEFAULT_USERS: SiteUser[] = [
  { id: "admin", username: "admin", password: "Admin@2024", role: "admin" },
  { id: "u1", username: "user1", password: "User1@2024", role: "user" },
  { id: "u2", username: "user2", password: "User2@2024", role: "user" },
  { id: "u3", username: "user3", password: "User3@2024", role: "user" },
  { id: "u4", username: "user4", password: "User4@2024", role: "user" },
  { id: "u5", username: "user5", password: "User5@2024", role: "user" },
  { id: "u6", username: "user6", password: "User6@2024", role: "user" },
  { id: "u7", username: "user7", password: "User7@2024", role: "user" },
  { id: "u8", username: "user8", password: "User8@2024", role: "user" },
  { id: "u9", username: "user9", password: "User9@2024", role: "user" },
  { id: "u10", username: "user10", password: "User10@2024", role: "user" },
];

function seedUsersFromEnv(): SiteUser[] | null {
  const username = process.env.SITE_AUTH_USERNAME?.trim();
  const password = process.env.SITE_AUTH_PASSWORD?.trim();
  if (!username || !password) return null;
  return [{ id: "admin", username, password, role: "admin" }];
}

/** Keep admin row in sync with SITE_AUTH_* on Render/local (runs every server start). */
async function syncAdminFromEnv(): Promise<void> {
  const envAdmin = seedUsersFromEnv();
  if (!envAdmin) return;

  const sb = getSupabase();
  const admin = envAdmin[0];
  const { error } = await sb.from("site_users").upsert(admin, { onConflict: "id" });
  if (error) {
    console.error("[users] sync admin from env failed:", error.message);
  }
}

/** Seed users on first deploy if table is empty; then sync admin from env when set. */
export async function initUsers(): Promise<void> {
  try {
    const sb = getSupabase();
    const { count } = await sb
      .from("site_users")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) === 0) {
      const seeds = seedUsersFromEnv() ?? DEFAULT_USERS;
      await sb.from("site_users").insert(seeds);
    }
    await syncAdminFromEnv();
  } catch (e) {
    console.error("[users] init failed:", e);
  }
}

export async function getAllUsers(): Promise<SiteUser[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("site_users")
    .select("*")
    .order("id");
  if (error) throw error;
  return (data ?? []) as SiteUser[];
}

export async function findUserByCredentials(
  username: string,
  password: string,
): Promise<SiteUser | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("site_users")
    .select("*")
    .eq("username", username.trim())
    .eq("password", password)
    .maybeSingle();
  return (data as SiteUser) ?? null;
}

export async function findUserById(id: string): Promise<SiteUser | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("site_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as SiteUser) ?? null;
}

export async function addUser(
  username: string,
  password: string,
  role: UserRole = "user",
): Promise<{ ok: true; user: SiteUser } | { ok: false; error: string }> {
  const sb = getSupabase();

  if (role === "user") {
    const { count } = await sb
      .from("site_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "user");
    if ((count ?? 0) >= MAX_WORKER_ACCOUNTS) {
      return { ok: false, error: `Maximum of ${MAX_WORKER_ACCOUNTS} worker accounts allowed` };
    }
  }

  const newUser: SiteUser = {
    id: `u_${Date.now()}`,
    username: username.trim(),
    password,
    role,
  };
  const { error } = await sb.from("site_users").insert(newUser);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Username already exists" };
    return { ok: false, error: error.message };
  }
  return { ok: true, user: newUser };
}

export async function updateUser(
  id: string,
  updates: { username?: string; password?: string; role?: UserRole },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  const patch: { username?: string; password?: string; role?: string } = {};
  if (updates.username?.trim()) patch.username = updates.username.trim();
  if (updates.password) patch.password = updates.password;
  if (updates.role) patch.role = updates.role;

  const { error } = await sb.from("site_users").update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Username already taken" };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  const user = await findUserById(id);
  if (!user) return { ok: false, error: "User not found" };

  if (user.role === "admin") {
    const { count } = await sb
      .from("site_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cannot remove the last admin account" };
    }
  }

  const { error } = await sb.from("site_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
