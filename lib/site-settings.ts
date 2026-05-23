import { getSupabase } from "./supabase";

export interface LockedSetting {
  pid: number;
  name: string;
  country: string;
}

export interface SiteSettings {
  lock: LockedSetting | null;
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "lock")
      .maybeSingle();
    return { lock: (data?.value as LockedSetting) ?? null };
  } catch {
    return { lock: null };
  }
}

export async function saveSettings(settings: SiteSettings): Promise<void> {
  const sb = getSupabase();
  await sb.from("site_settings").upsert({ key: "lock", value: settings.lock });
}
