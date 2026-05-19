/**
 * Pre-warms the DurianRCS service cache (valid project IDs).
 * Run: npm run sync-services
 * Requires .env.local with DURIAN_USERNAME and DURIAN_API_KEY.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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
    // .env.local optional for manual env vars
  }
}

await loadEnvFile(path.join(root, ".env.local"));

const username = process.env.DURIAN_USERNAME;
const apiKey = process.env.DURIAN_API_KEY;
const maxPid = Number(process.env.DURIAN_MAX_PID ?? 2500);
const base = "https://api.durianrcs.com/out/ext_api/";
const fakePhone = encodeURIComponent("+10000000000");
const invalidCode = 904;

if (!username || !apiKey) {
  console.error("Missing DURIAN_USERNAME or DURIAN_API_KEY in .env.local");
  process.exit(1);
}

function buildUrl(endpoint, params) {
  const url = new URL(endpoint, base);
  url.searchParams.set("name", username);
  url.searchParams.set("ApiKey", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function isPidValid(pid) {
  const url = buildUrl("getStatus", { pid, pn: fakePhone, serial: 2 });
  const res = await fetch(url);
  const json = await res.json();
  return json.code !== invalidCode;
}

async function main() {
  console.log(`Scanning project IDs 1–${maxPid}…`);
  const valid = [];
  const batchSize = 25;

  for (let start = 1; start <= maxPid; start += batchSize) {
    const end = Math.min(start + batchSize - 1, maxPid);
    const batch = [];
    for (let pid = start; pid <= end; pid++) batch.push(pid);

    const results = await Promise.all(
      batch.map(async (pid) => ({ pid, ok: await isPidValid(pid) })),
    );

    for (const { pid, ok } of results) {
      if (ok) valid.push(pid);
    }

    process.stdout.write(`\rChecked ${end}/${maxPid} — ${valid.length} services found`);
  }

  console.log("\nWriting cache…");

  const services = valid.map((pid) => ({ pid, name: `Project ${pid}` }));
  const cachePath = path.join(root, ".cache", "services.json");
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(
    cachePath,
    JSON.stringify({ updatedAt: new Date().toISOString(), services }, null, 2),
    "utf8",
  );

  console.log(`Done. ${services.length} services saved to .cache/services.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
