import { writeCache } from "./discover-services";
import { fetchAllPanelProjects } from "./durian-panel";

export async function syncServicesCatalogFromPanel(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  try {
    const services = await fetchAllPanelProjects({ forceRefresh: true });
    if (services.length === 0) {
      return {
        ok: false,
        count: 0,
        error:
          "Durian panel returned no services. Check DURIAN_SESSION_COOKIE and DURIAN_WEB_PASSWORD.",
      };
    }
    await writeCache(services);
    return { ok: true, count: services.length };
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : "Panel sync failed",
    };
  }
}
