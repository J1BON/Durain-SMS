/**
 * Print DURIAN_SESSION_COOKIE for cloud hosting (Render, Railway, etc.)
 *
 * Run locally after: npm run panel-login
 * Then paste the line into your host's environment variables.
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiePath = path.join(__dirname, "..", ".cache", "panel-cookies.json");

async function main() {
  let raw;
  try {
    raw = await readFile(cookiePath, "utf8");
  } catch {
    console.error(
      "No .cache/panel-cookies.json — run: npm run panel-login\nThen run this script again.",
    );
    process.exit(1);
  }

  const cookies = JSON.parse(raw);
  const line = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  if (!line) {
    console.error("Cookie file is empty. Run: npm run panel-login");
    process.exit(1);
  }

  console.log("\nAdd this to your hosting dashboard as DURIAN_SESSION_COOKIE:\n");
  console.log(line);
  console.log(
    "\n(Session expires eventually — refresh with panel-login + this script.)\n",
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
