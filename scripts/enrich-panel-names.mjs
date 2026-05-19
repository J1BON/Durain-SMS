/**
 * Apply DurianRCS panel display names to .cache/services.json
 * Run: node scripts/enrich-panel-names.mjs
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function normalizePid(raw) {
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePanelHtml(html) {
  const map = new Map();
  const pattern =
    /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]+)<\/option>/gi;
  for (const match of html.matchAll(pattern)) {
    const pid = normalizePid(match[1]);
    const name = match[2].trim();
    if (!pid || !name || name.toLowerCase().startsWith("select ")) continue;
    if (name === "所有国家" || name.toLowerCase() === "all countries") continue;
    map.set(pid, name);
  }
  return map;
}

async function main() {
  const cookies = JSON.parse(
    await readFile(path.join(root, ".cache", "panel-cookies.json"), "utf8"),
  );
  const hdr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch("https://mm.durianrcs.com/admin/get_sms", {
    headers: { Cookie: hdr },
  });
  const html = await res.text();
  const panelNames = parsePanelHtml(html);

  const cachePath = path.join(root, ".cache", "services.json");
  const cache = JSON.parse(await readFile(cachePath, "utf8"));
  let updated = 0;

  for (const svc of cache.services) {
    const name = panelNames.get(svc.pid);
    if (name && name !== svc.name) {
      svc.name = name;
      updated++;
    }
  }

  cache.updatedAt = new Date().toISOString();
  await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");

  const ms = cache.services.find((s) => /microsoft/i.test(s.name));
  console.log(`Updated ${updated} names. pid 3:`, cache.services.find((s) => s.pid === 3));
  console.log("Microsoft sample:", ms);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
