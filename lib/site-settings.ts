import { getSupabase } from "./supabase";

export interface LockedSetting {
  pid: number;
  name: string;
  country: string;
}

export interface SiteSettings {
  lock: LockedSetting | null;
  statsResetAt: number | null;
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from("site_settings").select("key, value");
    let lock: LockedSetting | null = null;
    let statsResetAt: number | null = null;
    for (const row of data ?? []) {
      if (row.key === "lock") lock = (row.value as LockedSetting) ?? null;
      if (row.key === "stats_reset_at") {
        const v = row.value as { at?: number } | number | null;
        if (typeof v === "number") statsResetAt = v;
        else if (v && typeof v === "object" && typeof v.at === "number") {
          statsResetAt = v.at;
        }
      }
    }
    return { lock, statsResetAt };
  } catch {
    return { lock: null, statsResetAt: null };
  }
}

export async function saveLock(lock: LockedSetting | null): Promise<void> {
  const sb = getSupabase();
  await sb.from("site_settings").upsert({ key: "lock", value: lock });
}

export async function setStatsResetAt(at: number): Promise<void> {
  const sb = getSupabase();
  await sb.from("site_settings").upsert({
    key: "stats_reset_at",
    value: { at },
  });
}
