/**
 * DurianRCS auto-sync — full project catalog + services cache.
 *
 * Usage:
 *   node scripts/durian-auto-sync.mjs           # smart sync (skip if up to date)
 *   node scripts/durian-auto-sync.mjs --force   # always fetch all projects
 *   node scripts/durian-auto-sync.mjs --fix     # used by FIX-AND-START.bat
 *   node scripts/durian-auto-sync.mjs --daemon  # background loop
 *   node scripts/durian-auto-sync.mjs --quiet   # minimal logging
 *   node scripts/durian-auto-sync.mjs --check   # exit 0 if panel session OK
 */
import {
  access,
  mkdir,
  readFile,
  writeFile,
  unlink,
  stat,
} from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const CACHE_DIR = path.join(root, ".cache");
const COOKIE_PATH = path.join(CACHE_DIR, "panel-cookies.json");
const PANEL_PROJECTS_PATH = path.join(CACHE_DIR, "panel-projects.json");
const SERVICES_PATH = path.join(CACHE_DIR, "services.json");
const LOCK_PATH = path.join(CACHE_DIR, "auto-sync.lock");
const PAGE_SIZE = 10;
const PANEL_LIST_URL =
  "https://mm.durianrcs.com/admin/project_list/json_list";

const args = new Set(process.argv.slice(2));
const quiet = args.has("--quiet");
const force = args.has("--force");
const fixMode = args.has("--fix");
const daemon = args.has("--daemon");
const checkOnly = args.has("--check");

function log(...parts) {
  if (!quiet) console.log(...parts);
}

function logErr(...parts) {
  console.error(...parts);
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

function cookieHeaderFromMap(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function resolveCookieHeader() {
  const envCookie = process.env.DURIAN_SESSION_COOKIE?.trim();
  if (envCookie) return envCookie;

  const cookies = await readJson(COOKIE_PATH);
  if (cookies && Object.keys(cookies).length > 0) {
    return cookieHeaderFromMap(cookies);
  }

  return null;
}

async function probePanel(hdr) {
  const url = new URL(PANEL_LIST_URL);
  url.searchParams.set("draw", "1");
  url.searchParams.set("start", "0");
  url.searchParams.set("length", String(PAGE_SIZE));

  const res = await fetch(url.toString(), {
    headers: {
      Cookie: hdr,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return { ok: false, total: 0 };
  }

  const json = await res.json();
  return {
    ok: Array.isArray(json.data),
    total: json.recordsFiltered ?? json.recordsTotal ?? 0,
  };
}

function getMaxAgeMs() {
  const hours = Number(process.env.DURIAN_SYNC_MAX_AGE_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60 * 1000;
}

function getDaemonIntervalMs() {
  const minutes = Number(process.env.DURIAN_AUTO_SYNC_MINUTES ?? 30);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
}

async function needsSync(remoteTotal, cached) {
  if (force) return true;
  if (!cached?.services?.length) return true;
  if (cached.services.length < 2000) return true;
  if (remoteTotal > 0 && cached.services.length !== remoteTotal) {
    log(
      `Panel has ${remoteTotal} projects, cache has ${cached.services.length} — syncing…`,
    );
    return true;
  }
  if (cached.updatedAt) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age > getMaxAgeMs()) {
      log("Cache expired — syncing…");
      return true;
    }
  }
  return false;
}

async function fetchAllProjects(hdr) {
  const byPid = new Map();
  let start = 0;
  let total = Number.POSITIVE_INFINITY;

  while (start < total) {
    const url = new URL(PANEL_LIST_URL);
    url.searchParams.set("draw", "1");
    url.searchParams.set("start", String(start));
    url.searchParams.set("length", String(PAGE_SIZE));

    const res = await fetch(url.toString(), {
      headers: {
        Cookie: hdr,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Panel project list failed (${res.status})`);
    }

    const json = await res.json();
    total = json.recordsFiltered ?? json.recordsTotal ?? 0;

    for (const row of json.data ?? []) {
      const pid = Number.parseInt(String(row.id).trim(), 10);
      const name = row.name?.trim();
      if (pid > 0 && name) {
        byPid.set(pid, {
          pid,
          name,
          cost: typeof row.cost === "number" ? row.cost : undefined,
          serial: row.serial === 1 ? 1 : 2,
        });
      }
    }

    if (!quiet) {
      process.stdout.write(`\r  Fetched ${byPid.size} / ${total} projects`);
    }

    if (!json.data?.length) break;
    start += json.data.length;
  }

  if (!quiet) process.stdout.write("\n");

  return [...byPid.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function writeCaches(services) {
  await mkdir(CACHE_DIR, { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), services };
  const raw = JSON.stringify(payload, null, 2);
  await writeFile(PANEL_PROJECTS_PATH, raw, "utf8");
  await writeFile(SERVICES_PATH, raw, "utf8");
}

export async function runSync(options = {}) {
  const opts = {
    quiet: options.quiet ?? quiet,
    force: options.force ?? force,
    checkOnly: options.checkOnly ?? checkOnly,
  };

  await loadEnvFile(path.join(root, ".env.local"));

  const hdr = await resolveCookieHeader();
  if (!hdr) {
    const msg =
      "No panel session. Run: npm run panel-login\nOr set DURIAN_SESSION_COOKIE in .env.local";
    if (opts.checkOnly) {
      logErr(msg);
      return { ok: false, reason: "no_cookies" };
    }
    throw new Error(msg);
  }

  const probe = await probePanel(hdr);
  if (!probe.ok) {
    const msg =
      "Panel session expired. Run: npm run panel-login\nOr update DURIAN_SESSION_COOKIE in .env.local";
    if (opts.checkOnly) {
      logErr(msg);
      return { ok: false, reason: "expired" };
    }
    throw new Error(msg);
  }

  if (opts.checkOnly) {
    log(`Panel session OK (${probe.total} projects on DurianRCS)`);
    return { ok: true, total: probe.total };
  }

  const cached =
    (await readJson(PANEL_PROJECTS_PATH)) ?? (await readJson(SERVICES_PATH));

  if (!(await needsSync(probe.total, cached)) && !opts.force) {
    log(`Already up to date (${cached.services.length} services).`);
    return {
      ok: true,
      synced: false,
      count: cached.services.length,
      total: probe.total,
    };
  }

  log(`Syncing ${probe.total} projects from DurianRCS panel…`);
  const services = await fetchAllProjects(hdr);
  await writeCaches(services);
  log(`Done — ${services.length} services saved for your site.`);

  return {
    ok: true,
    synced: true,
    count: services.length,
    total: probe.total,
  };
}

async function acquireDaemonLock() {
  await mkdir(CACHE_DIR, { recursive: true });
  if (await fileExists(LOCK_PATH)) {
    try {
      const st = await stat(LOCK_PATH);
      const age = Date.now() - st.mtimeMs;
      if (age < getDaemonIntervalMs() * 0.9) {
        log("Auto-sync daemon already running — exiting.");
        process.exit(0);
      }
    } catch {
      // continue
    }
  }
  await writeFile(LOCK_PATH, String(process.pid), "utf8");
}

async function releaseDaemonLock() {
  try {
    await unlink(LOCK_PATH);
  } catch {
    // ignore
  }
}

async function runDaemon() {
  await acquireDaemonLock();
  log(
    `Durian auto-sync daemon started (every ${process.env.DURIAN_AUTO_SYNC_MINUTES ?? 30} min).`,
  );
  log("Close this window to stop background sync.");

  const tick = async () => {
    try {
      await runSync({ quiet: true, force: false });
    } catch (err) {
      logErr("[auto-sync]", err.message ?? err);
    }
  };

  await tick();
  const interval = setInterval(tick, getDaemonIntervalMs());

  const cleanup = async () => {
    clearInterval(interval);
    await releaseDaemonLock();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

async function main() {
  await loadEnvFile(path.join(root, ".env.local"));

  if (daemon) {
    await runDaemon();
    return;
  }

  if (checkOnly) {
    const result = await runSync();
    process.exit(result.ok ? 0 : 1);
  }

  if (fixMode) {
    log("=== Durain SMS — fix & sync ===\n");

    if (!(await fileExists(path.join(root, ".env.local")))) {
      logErr(
        "Missing .env.local — copy .env.example and set DURIAN_USERNAME, DURIAN_API_KEY, DURIAN_WEB_PASSWORD",
      );
      process.exit(1);
    }

    const session = await runSync({ checkOnly: true });
    if (!session.ok) {
      log("\nPanel login required. Starting captcha login…\n");
      const { spawn } = await import("child_process");
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.platform === "win32" ? "npm.cmd" : "npm",
          ["run", "panel-login"],
          { cwd: root, stdio: "inherit", shell: true },
        );
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error("panel-login failed")),
        );
      });
    }
  }

  const result = await runSync({ force: fixMode || force });
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  logErr(err.message ?? err);
  process.exit(1);
});
