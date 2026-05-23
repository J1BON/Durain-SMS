/**
 * One-time setup: create tables + admin user in Supabase.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/setup-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_KEY?.trim();
const adminUser = process.env.SITE_AUTH_USERNAME?.trim() || "va2256h";
const adminPass = process.env.SITE_AUTH_PASSWORD?.trim();

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}
if (!adminPass) {
  console.error("Set SITE_AUTH_PASSWORD (or pass admin password in env)");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const ddl = readFileSync(join(__dirname, "../supabase/schema.sql"), "utf8");
// Supabase JS cannot run arbitrary DDL; use REST rpc or manual. Run statements via postgres - skip.
// Use table operations only.

async function ensureTablesViaProbe() {
  const { error } = await sb.from("site_users").select("id").limit(1);
  if (error?.code === "PGRST205" || error?.message?.includes("does not exist")) {
    console.error(
      "Tables missing. Run supabase/schema.sql in Supabase SQL Editor first, then re-run this script.",
    );
    process.exit(1);
  }
}

async function main() {
  await ensureTablesViaProbe();

  const { error } = await sb.from("site_users").upsert(
    {
      id: "admin",
      username: adminUser,
      password: adminPass,
      role: "admin",
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  const { data } = await sb.from("site_users").select("id, username, role");
  console.log("site_users:", data);
  console.log("Admin ready:", adminUser);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
