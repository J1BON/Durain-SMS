/** @deprecated Use: npm run durian-sync or FIX-AND-START.bat */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptsDir, "..");
const child = spawn(process.execPath, [path.join(scriptsDir, "durian-auto-sync.mjs"), "--force"], {
  cwd: root,
  stdio: "inherit",
});
child.on("close", (code) => process.exit(code ?? 0));
