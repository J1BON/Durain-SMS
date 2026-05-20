import { promises as fs } from "fs";
import path from "path";
import { fetchAllPanelProjects } from "./durian-panel";
import { getPanelSetupHint, hasPanelSession } from "./panel-session";
import type { Service } from "./types";

export type { Service } from "./types";

type ServiceCache = {
  updatedAt: string;
  services: Service[];
};

const CACHE_PATH = path.join(process.cwd(), ".cache", "services.json");
const MIN_COMPLETE_CATALOG = 2000;

function getCacheTtlMs(): number {
  const hours = Number(process.env.DURIAN_SERVICE_CACHE_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60 * 1000;
}

async function readCache(): Promise<ServiceCache | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    return JSON.parse(raw) as ServiceCache;
  } catch {
    return null;
  }
}

export async function writeCache(services: Service[]): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  const payload: ServiceCache = {
    updatedAt: new Date().toISOString(),
    services,
  };
  await fs.writeFile(CACHE_PATH, JSON.stringify(payload), "utf8");
}

function isCacheUsable(cache: ServiceCache | null): boolean {
  if (!cache?.updatedAt || !cache.services?.length) return false;
  if (cache.services.length < MIN_COMPLETE_CATALOG) return false;
  const age = Date.now() - new Date(cache.updatedAt).getTime();
  return age < getCacheTtlMs();
}

let backgroundRefresh: Promise<Service[] | null> | null = null;

function refreshFromPanelInBackground(): void {
  if (backgroundRefresh) return;

  backgroundRefresh = (async () => {
    try {
      const services = await fetchAllPanelProjects({ forceRefresh: true });
      if (services.length > 0) {
        await writeCache(services);
      }
      return services.length > 0 ? services : null;
    } catch (err) {
      console.error("[getServices] background panel refresh failed:", err);
      return null;
    } finally {
      backgroundRefresh = null;
    }
  })();
}

/**
 * Fast path: disk cache when fresh.
 * Background: refresh from Durian panel when stale or ?refresh=1 (does not block the response).
 */
export async function getServices(options?: {
  forceRefresh?: boolean;
}): Promise<{
  services: Service[];
  cached: boolean;
  updatedAt?: string;
  source: "panel" | "cache";
  refreshing?: boolean;
  setupHint?: string;
}> {
  const forceRefresh = options?.forceRefresh ?? false;
  const cache = await readCache();

  if (isCacheUsable(cache) && !forceRefresh) {
    return {
      services: cache!.services,
      cached: true,
      updatedAt: cache!.updatedAt,
      source: "cache",
    };
  }

  if (isCacheUsable(cache) && forceRefresh) {
    refreshFromPanelInBackground();
    return {
      services: cache!.services,
      cached: true,
      updatedAt: cache!.updatedAt,
      source: "cache",
      refreshing: true,
    };
  }

  // Try panel disk cache (written by auto-sync) before hitting the network
  try {
    const fromPanelDisk = await fetchAllPanelProjects({ forceRefresh: false });
    if (fromPanelDisk.length >= MIN_COMPLETE_CATALOG) {
      await writeCache(fromPanelDisk);
      if (forceRefresh) refreshFromPanelInBackground();
      return {
        services: fromPanelDisk,
        cached: true,
        updatedAt: new Date().toISOString(),
        source: "cache",
        refreshing: forceRefresh,
      };
    }
  } catch {
    // continue to live fetch
  }

  try {
    const services = await fetchAllPanelProjects({ forceRefresh: true });
    if (services.length > 0) {
      await writeCache(services);
      return {
        services,
        cached: false,
        updatedAt: new Date().toISOString(),
        source: "panel",
      };
    }
  } catch (err) {
    console.error("[getServices] panel fetch failed:", err);
  }

  if (cache?.services?.length) {
    refreshFromPanelInBackground();
    return {
      services: cache.services,
      cached: true,
      updatedAt: cache.updatedAt,
      source: "cache",
      refreshing: true,
    };
  }

  const hasSession = await hasPanelSession();
  return {
    services: [],
    cached: false,
    source: "cache",
    setupHint: getPanelSetupHint(hasSession),
  };
}
