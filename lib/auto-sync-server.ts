import { spawn } from "child_process";
import path from "path";

let started = false;
let syncing = false;

function runSyncScript() {
  if (syncing) return;
  syncing = true;

  const script = path.join(process.cwd(), "scripts", "durian-auto-sync.mjs");
  const child = spawn(process.execPath, [script, "--quiet"], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env,
  });

  child.on("close", () => {
    syncing = false;
  });
  child.on("error", () => {
    syncing = false;
  });
}

/** Background sync while Next.js dev/production server is running. */
export function startDurianAutoSync() {
  if (started) return;
  if (process.env.DURIAN_AUTO_SYNC_DISABLED === "1") return;

  started = true;

  const minutes = Number(process.env.DURIAN_AUTO_SYNC_MINUTES ?? 30);
  const intervalMs =
    (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;

  // First check shortly after server boot (cache may already be fresh from FIX-AND-START.bat).
  setTimeout(runSyncScript, 15_000);
  setInterval(runSyncScript, intervalMs);
}
