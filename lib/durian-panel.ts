import { promises as fs } from "fs";
import path from "path";
import type { Service } from "./types";

const PANEL_BASE = "https://mm.durianrcs.com";
const PANEL_LOGIN_PAGE = `${PANEL_BASE}/admin/index/login`;
const PANEL_SMS_PATH = "/admin/get_sms";
const COOKIE_CACHE_PATH = path.join(process.cwd(), ".cache", "panel-cookies.json");
const PANEL_NAMES_CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "panel-names.json",
);
const PANEL_PROJECTS_CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "panel-projects.json",
);
const PANEL_NAMES_CACHE_MS = 60 * 60 * 1000;
const PANEL_PROJECTS_CACHE_MS = 6 * 60 * 60 * 1000;
/** Panel DataTables endpoint returns 10 rows per request unless full column schema is sent. */
const PROJECT_LIST_PAGE_SIZE = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPanelFetchConcurrency(): number {
  const n = Number(process.env.DURIAN_PANEL_FETCH_CONCURRENCY ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 3;
}

function getPanelFetchDelayMs(): number {
  const n = Number(process.env.DURIAN_PANEL_FETCH_DELAY_MS ?? 120);
  return Number.isFinite(n) && n >= 0 ? n : 120;
}

/** Sequential fetch avoids 503 rate limits from the Durian panel on cloud hosts. */
function shouldUseSequentialPanelFetch(): boolean {
  const mode = process.env.DURIAN_PANEL_FETCH_MODE?.trim().toLowerCase();
  if (mode === "parallel") return false;
  if (mode === "sequential") return true;
  return process.env.NODE_ENV === "production";
}

function isRetryablePanelStatus(status: number): boolean {
  return (
    Number.isFinite(status) &&
    (status === 429 || status === 502 || status === 503 || status === 504)
  );
}

/** Login / session-expired HTML from the Durian panel (not DataTables JSON). */
function panelHtmlLooksLikeLoginPage(html: string): boolean {
  const sample = html.slice(0, 12_000);
  const lower = sample.toLowerCase();
  return (
    sample.includes('id="logins"') ||
    sample.includes('placeholder="用户名"') ||
    sample.includes("placeholder=\"用户名\"") ||
    (lower.includes("<form") &&
      lower.includes("password") &&
      (lower.includes("login") || lower.includes("sign in")))
  );
}

type PanelProjectRow = {
  id: string;
  name: string;
  cost?: number;
  serial?: number;
};

type PanelProjectListResponse = {
  recordsTotal: number;
  recordsFiltered: number;
  data: PanelProjectRow[];
};

type PanelProjectsCache = {
  updatedAt: string;
  services: Service[];
};

export type PanelCookies = Record<string, string>;

/** Parse project id from Durian panel values like "0003" or "3". */
export function normalizePanelPid(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return numeric;
}

/** Extract services from the DurianRCS get_sms HTML (select options + table rows). */
export function parsePanelHtml(html: string): Service[] {
  const byPid = new Map<number, Service>();

  const optionPattern =
    /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]+)<\/option>/gi;
  for (const match of html.matchAll(optionPattern)) {
    const pid = normalizePanelPid(match[1]);
    const name = decodeHtmlEntities(match[2].trim());
    if (!pid || !name || isPlaceholderName(name)) continue;
    byPid.set(pid, { pid, name });
  }

  // Select2 / chosen style: <option value="0003" data-select2-id="...">Microsoft</option>
  const optionLoosePattern =
    /<option[^>]*value=["']?(\d+)["']?[^>]*>([^<]{2,})<\//gi;
  for (const match of html.matchAll(optionLoosePattern)) {
    const pid = normalizePanelPid(match[1]);
    const name = decodeHtmlEntities(match[2].trim());
    if (!pid || !name || isPlaceholderName(name)) continue;
    if (!byPid.has(pid)) byPid.set(pid, { pid, name });
  }

  // Table row: project id in last columns, name in earlier cell with icon
  const rowPattern =
    /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>\s*([^<]{2,}?)\s*<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>\s*(\d{1,6})\s*<\/td>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const name = decodeHtmlEntities(match[1].trim());
    const pid = normalizePanelPid(match[2]);
    if (!pid || !name || isPlaceholderName(name)) continue;
    if (!byPid.has(pid)) byPid.set(pid, { pid, name });
  }

  return Array.from(byPid.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

function isPlaceholderName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === "select the project" ||
    lower === "select item" ||
    lower === "all countries" ||
    lower.startsWith("select ")
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cookieHeaderFromMap(cookies: PanelCookies): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export function cookieHeaderFromEnv(): string | null {
  const raw = process.env.DURIAN_SESSION_COOKIE?.trim();
  return raw || null;
}

export async function readCachedPanelCookies(): Promise<PanelCookies | null> {
  try {
    const raw = await fs.readFile(COOKIE_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PanelCookies;
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeCachedPanelCookies(
  cookies: PanelCookies,
): Promise<void> {
  await fs.mkdir(path.dirname(COOKIE_CACHE_PATH), { recursive: true });
  await fs.writeFile(COOKIE_CACHE_PATH, JSON.stringify(cookies), "utf8");
}

export async function fetchPanelHtml(cookieHeader: string): Promise<string> {
  const res = await fetch(`${PANEL_BASE}${PANEL_SMS_PATH}`, {
    headers: {
      Cookie: cookieHeader,
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "DurainSMS-PanelSync/1.0",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Panel request failed (${res.status})`);
  }

  const html = await res.text();

  if (panelHtmlLooksLikeLoginPage(html)) {
    throw new Error(
      "Durian panel session expired. Run npm run panel-login or set DURIAN_SESSION_COOKIE in .env.local",
    );
  }

  return html;
}

export async function fetchPanelServices(): Promise<Service[]> {
  const map = await fetchPanelNameMap();
  return Array.from(map.entries())
    .map(([pid, name]) => ({ pid, name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

type PanelNamesCache = {
  updatedAt: string;
  names: Record<string, string>;
};

async function readPanelNamesCache(): Promise<Map<number, string> | null> {
  try {
    const raw = await fs.readFile(PANEL_NAMES_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PanelNamesCache;
    if (!parsed.updatedAt || !parsed.names) return null;

    const age = Date.now() - new Date(parsed.updatedAt).getTime();
    if (age > PANEL_NAMES_CACHE_MS) return null;

    const map = new Map<number, string>();
    for (const [key, name] of Object.entries(parsed.names)) {
      const pid = normalizePanelPid(key);
      if (pid && name) map.set(pid, name);
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

async function writePanelNamesCache(map: Map<number, string>): Promise<void> {
  const names: Record<string, string> = {};
  for (const [pid, name] of map) {
    names[String(pid)] = name;
  }
  await fs.mkdir(path.dirname(PANEL_NAMES_CACHE_PATH), { recursive: true });
  const payload: PanelNamesCache = {
    updatedAt: new Date().toISOString(),
    names,
  };
  await fs.writeFile(PANEL_NAMES_CACHE_PATH, JSON.stringify(payload), "utf8");
}

async function getPanelCookieHeader(): Promise<string | null> {
  const envCookie = cookieHeaderFromEnv();
  const cached = await readCachedPanelCookies();
  return envCookie ?? (cached ? cookieHeaderFromMap(cached) : null);
}

function panelAjaxHeaders(cookieHeader: string): Record<string, string> {
  return {
    Cookie: cookieHeader,
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json, text/javascript, */*; q=0.01",
    Referer: `${PANEL_BASE}/admin/index/index`,
  };
}

function rowToService(row: PanelProjectRow): Service | null {
  const pid = normalizePanelPid(row.id);
  const name = row.name?.trim();
  if (!pid || !name) return null;

  const serial =
    row.serial === 1 || row.serial === 2 ? row.serial : 2;

  return {
    pid,
    name,
    cost: typeof row.cost === "number" ? row.cost : undefined,
    serial,
  };
}

async function readPanelProjectsCache(): Promise<Service[] | null> {
  try {
    const raw = await fs.readFile(PANEL_PROJECTS_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PanelProjectsCache;
    if (!parsed.updatedAt || !parsed.services?.length) return null;

    const age = Date.now() - new Date(parsed.updatedAt).getTime();
    if (age > PANEL_PROJECTS_CACHE_MS) return null;

    return parsed.services;
  } catch {
    return null;
  }
}

/** Last good panel snapshot (ignores TTL) when live panel fetch fails (expired cookie, 503, HTML). */
async function readPanelProjectsCacheIgnoringAge(): Promise<Service[] | null> {
  try {
    const raw = await fs.readFile(PANEL_PROJECTS_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PanelProjectsCache;
    return parsed.services?.length ? parsed.services : null;
  } catch {
    return null;
  }
}

async function writePanelProjectsCache(services: Service[]): Promise<void> {
  await fs.mkdir(path.dirname(PANEL_PROJECTS_CACHE_PATH), { recursive: true });
  const payload: PanelProjectsCache = {
    updatedAt: new Date().toISOString(),
    services,
  };
  await fs.writeFile(
    PANEL_PROJECTS_CACHE_PATH,
    JSON.stringify(payload),
    "utf8",
  );
}

async function fetchProjectListPage(
  headers: Record<string, string>,
  start: number,
): Promise<{ rows: PanelProjectRow[]; total: number }> {
  const url = new URL(`${PANEL_BASE}/admin/project_list/json_list`);
  url.searchParams.set("draw", "1");
  url.searchParams.set("start", String(start));
  url.searchParams.set("length", String(PROJECT_LIST_PAGE_SIZE));

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Panel project list failed (${res.status})`);
  }

  const json = await parsePanelJsonResponse<PanelProjectListResponse>(res);
  return {
    rows: json.data ?? [],
    total: json.recordsFiltered ?? json.recordsTotal ?? 0,
  };
}

async function fetchProjectListPageWithRetry(
  headers: Record<string, string>,
  start: number,
): Promise<{ rows: PanelProjectRow[]; total: number }> {
  const maxAttempts = 5;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchProjectListPage(headers, start);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const statusMatch = /\((\d{3})\)/.exec(lastError.message);
      const httpStatus = statusMatch ? Number(statusMatch[1]) : NaN;
      const retryable =
        isRetryablePanelStatus(httpStatus) ||
        /\(429\)|\(502\)|\(503\)|\(504\)/.test(lastError.message);
      if (!retryable || attempt === maxAttempts - 1) break;
      await sleep(600 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Panel project list failed");
}

async function fetchAllPanelProjectsSequential(
  headers: Record<string, string>,
  byPid: Map<number, Service>,
): Promise<number> {
  const delayMs = getPanelFetchDelayMs();
  let start = 0;
  let total = Number.POSITIVE_INFINITY;

  while (start < total) {
    const page = await fetchProjectListPageWithRetry(headers, start);
    total = page.total;
    mergeProjectRows(byPid, page.rows);
    start += PROJECT_LIST_PAGE_SIZE;
    if (start < total && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return total;
}

function mergeProjectRows(
  byPid: Map<number, Service>,
  rows: PanelProjectRow[],
): void {
  for (const row of rows) {
    const svc = rowToService(row);
    if (svc) byPid.set(svc.pid, svc);
  }
}

/**
 * Full project catalog from the panel (same as Project list — 2600+ services).
 * Uses parallel pagination when a live fetch is required.
 */
export async function fetchAllPanelProjects(options?: {
  forceRefresh?: boolean;
}): Promise<Service[]> {
  if (!options?.forceRefresh) {
    const cached = await readPanelProjectsCache();
    if (cached) return cached;
  }

  const cookieHeader = await getPanelCookieHeader();
  if (!cookieHeader) {
    const staleOnly = await readPanelProjectsCacheIgnoringAge();
    return staleOnly ?? [];
  }

  const headers = panelAjaxHeaders(cookieHeader);
  const byPid = new Map<number, Service>();

  try {
    if (shouldUseSequentialPanelFetch()) {
      await fetchAllPanelProjectsSequential(headers, byPid);
    } else {
      const concurrency = getPanelFetchConcurrency();
      const delayMs = getPanelFetchDelayMs();

      const first = await fetchProjectListPageWithRetry(headers, 0);
      const total = first.total;
      mergeProjectRows(byPid, first.rows);

      const pageStarts: number[] = [];
      for (
        let start = PROJECT_LIST_PAGE_SIZE;
        start < total;
        start += PROJECT_LIST_PAGE_SIZE
      ) {
        pageStarts.push(start);
      }

      for (let i = 0; i < pageStarts.length; i += concurrency) {
        const batch = pageStarts.slice(i, i + concurrency);
        const pages = await Promise.all(
          batch.map((start) => fetchProjectListPageWithRetry(headers, start)),
        );
        for (const page of pages) {
          mergeProjectRows(byPid, page.rows);
        }
        if (i + concurrency < pageStarts.length && delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }

    const services = Array.from(byPid.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

    if (services.length > 0) {
      await writePanelProjectsCache(services);
    }

    return services;
  } catch (err) {
    console.error("[fetchAllPanelProjects] live panel fetch failed:", err);
    const stale = await readPanelProjectsCacheIgnoringAge();
    if (stale?.length) {
      console.warn(
        "[fetchAllPanelProjects] returning stale panel-projects cache after failure",
      );
      return stale;
    }
    throw err;
  }
}

/** Project id → display name from the DurianRCS web panel (Microsoft, Amazon, …). */
export async function fetchPanelNameMap(
  options?: { forceRefresh?: boolean },
): Promise<Map<number, string>> {
  if (!options?.forceRefresh) {
    const cached = await readPanelNamesCache();
    if (cached) return cached;
  }

  const cookieHeader = await getPanelCookieHeader();
  if (!cookieHeader) {
    return new Map();
  }

  const html = await fetchPanelHtml(cookieHeader);
  const services = parsePanelHtml(html);
  const map = new Map<number, string>();
  for (const svc of services) {
    map.set(svc.pid, svc.name);
  }

  if (map.size > 0) {
    await writePanelNamesCache(map);
  }

  return map;
}

/** Open the panel login page so PHP session cookies are issued before captcha/login. */
export async function beginPanelSession(jar: PanelCookies): Promise<void> {
  const res = await fetch(PANEL_LOGIN_PAGE, { cache: "no-store" });
  mergeSetCookie(jar, getSetCookies(res.headers));
}

function panelLoginAjaxHeaders(jar: PanelCookies): Record<string, string> {
  return {
    Cookie: cookieHeaderFromMap(jar),
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json, text/javascript, */*; q=0.01",
    Referer: PANEL_LOGIN_PAGE,
  };
}

async function parsePanelJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    if (panelHtmlLooksLikeLoginPage(trimmed)) {
      throw new Error(
        "Durian panel session expired or cookie invalid. Update DURIAN_SESSION_COOKIE on the server (npm run panel-login, then npm run export-panel-cookie) and restart the app.",
      );
    }
    throw new Error(
      "Durian panel returned a web page instead of JSON (temporary block or outage). Try again in a few minutes.",
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid panel response: ${trimmed.slice(0, 120)}`);
  }
}

export async function loginToPanel(options: {
  username: string;
  password: string;
  captcha: string;
  language?: string;
}): Promise<PanelCookies> {
  const jar: PanelCookies = {};

  await beginPanelSession(jar);

  const captchaRes = await fetch(`${PANEL_BASE}/valdatioCode`, {
    headers: { Cookie: cookieHeaderFromMap(jar) },
    cache: "no-store",
  });
  mergeSetCookie(jar, getSetCookies(captchaRes.headers));

  const verifyRes = await fetch(
    `${PANEL_BASE}/doCheckVerify?code=${encodeURIComponent(options.captcha)}`,
    {
      headers: { Cookie: cookieHeaderFromMap(jar) },
      cache: "no-store",
    },
  );
  mergeSetCookie(jar, getSetCookies(verifyRes.headers));

  const verifyBody = await verifyRes.text();
  if (verifyBody.trim() === "-1") {
    throw new Error("Invalid captcha code");
  }

  const body = new URLSearchParams({
    n: options.username,
    p: options.password,
    l: options.language ?? "en",
  });

  const loginRes = await fetch(PANEL_LOGIN_PAGE, {
    method: "POST",
    headers: {
      ...panelLoginAjaxHeaders(jar),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  mergeSetCookie(jar, getSetCookies(loginRes.headers));

  const loginJson = await parsePanelJsonResponse<{ code?: number; msg?: string }>(
    loginRes,
  );
  if (loginJson.code !== 1) {
    throw new Error(loginJson.msg ?? "Panel login failed");
  }

  await writeCachedPanelCookies(jar);
  return jar;
}

function getSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeSetCookie(jar: PanelCookies, setCookies: string[]): void {
  for (const line of setCookies) {
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
}
