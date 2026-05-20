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
    const message = err instanceof Error ? err.message : "Panel sync failed";
    let hint = "";
    if (/503|502|429/.test(message)) {
      hint = " Durian panel was busy — wait 1 minute and tap Sync again.";
    } else if (/session expired|cookie invalid/i.test(message)) {
      hint =
        " Run `npm run panel-login` locally, then `npm run export-panel-cookie`, and paste a fresh value into DURIAN_SESSION_COOKIE on your host.";
    }
    return {
      ok: false,
      count: 0,
      error: message + hint,
    };
  }
}
