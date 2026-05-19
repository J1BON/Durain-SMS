/**
 * Link your DurianRCS web panel session so service names load (Microsoft, Amazon, etc.)
 *
 * 1. Add to .env.local:
 *    DURIAN_WEB_PASSWORD=your_web_login_password
 *    (DURIAN_USERNAME should already match your DurianRCS login)
 *
 * 2. Run: npm run panel-login
 * 3. Open .cache/captcha.gif, enter the code when prompted
 */
import { createInterface } from "readline/promises";
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
    // optional
  }
}

function cookieHeaderFromMap(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeSetCookie(jar, setCookies) {
  for (const line of setCookies) {
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
}

async function main() {
  await loadEnvFile(path.join(root, ".env.local"));

  const username = process.env.DURIAN_USERNAME;
  const password = process.env.DURIAN_WEB_PASSWORD;

  if (!username || !password) {
    console.error(
      "Add DURIAN_USERNAME and DURIAN_WEB_PASSWORD to .env.local first.",
    );
    process.exit(1);
  }

  const jar = {};
  const base = "https://mm.durianrcs.com";
  const loginPage = `${base}/admin/index/login`;

  console.log("Opening panel session…");
  const sessionRes = await fetch(loginPage);
  mergeSetCookie(jar, sessionRes.headers.getSetCookie?.() ?? []);

  console.log("Fetching captcha…");
  const captchaRes = await fetch(`${base}/valdatioCode`, {
    headers: { Cookie: cookieHeaderFromMap(jar) },
  });
  mergeSetCookie(jar, captchaRes.headers.getSetCookie?.() ?? []);

  const captchaPath = path.join(root, ".cache", "captcha.gif");
  await mkdir(path.dirname(captchaPath), { recursive: true });
  await writeFile(captchaPath, Buffer.from(await captchaRes.arrayBuffer()));
  console.log(`Captcha saved: ${captchaPath}`);
  console.log("Open the image and enter the code below.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const captcha = (await rl.question("Captcha code: ")).trim();
  rl.close();

  const verifyRes = await fetch(
    `${base}/doCheckVerify?code=${encodeURIComponent(captcha)}`,
    { headers: { Cookie: cookieHeaderFromMap(jar) } },
  );
  mergeSetCookie(jar, verifyRes.headers.getSetCookie?.() ?? []);
  const verifyBody = await verifyRes.text();
  if (verifyBody.trim() === "-1") {
    console.error("Invalid captcha. Run the script again.");
    process.exit(1);
  }

  const loginRes = await fetch(loginPage, {
    method: "POST",
    headers: {
      Cookie: cookieHeaderFromMap(jar),
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: loginPage,
    },
    body: new URLSearchParams({ n: username, p: password, l: "en" }),
  });
  mergeSetCookie(jar, loginRes.headers.getSetCookie?.() ?? []);

  const loginText = await loginRes.text();
  if (loginText.trim().startsWith("<")) {
    console.error(
      "Login returned HTML instead of JSON. Check DURIAN_WEB_PASSWORD and try again.",
    );
    process.exit(1);
  }

  let loginJson;
  try {
    loginJson = JSON.parse(loginText);
  } catch {
    console.error("Unexpected login response:", loginText.slice(0, 200));
    process.exit(1);
  }

  if (loginJson.code !== 1) {
    console.error("Login failed:", loginJson.msg ?? loginJson);
    process.exit(1);
  }

  const cookiePath = path.join(root, ".cache", "panel-cookies.json");
  await writeFile(cookiePath, JSON.stringify(jar, null, 2), "utf8");
  console.log(`\nPanel session saved to ${cookiePath}`);

  const smsRes = await fetch(`${base}/admin/get_sms`, {
    headers: { Cookie: cookieHeaderFromMap(jar) },
  });
  const html = await smsRes.text();
  const matches = [...html.matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]+)<\/option>/gi)];
  const sample = matches
    .filter((m) => m[2].trim() && !m[2].toLowerCase().includes("select"))
    .slice(0, 8)
    .map((m) => `  ${m[1]} → ${m[2].trim()}`)
    .join("\n");

  console.log(`\nLoaded ${matches.length} options from panel. Sample:\n${sample}`);
  try {
    const { unlink } = await import("fs/promises");
    await unlink(path.join(root, ".cache", "panel-projects.json")).catch(() => {});
    await unlink(path.join(root, ".cache", "services.json")).catch(() => {});
  } catch {
    // ignore
  }

  console.log("\nRestart npm run dev — services will load all 2600+ projects from the panel.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
