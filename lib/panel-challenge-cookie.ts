import { createHmac, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie binding the captcha image to the Durian PHP session (see /panel-refresh). */
export const PANEL_CHALLENGE_COOKIE = "durain_panel_chal";

const CHALLENGE_MAX_MS = 12 * 60 * 1000;

export type PanelJarPayload = Record<string, string>;

function signingKey(): string {
  const s =
    process.env.SITE_AUTH_SECRET?.trim() ||
    process.env.DURIAN_API_KEY?.trim() ||
    "";
  return s || "durain-panel-chal-unsafe";
}

export function sealPanelChallengeJar(jar: PanelJarPayload): string {
  const payload = Buffer.from(
    JSON.stringify({ j: jar, exp: Date.now() + CHALLENGE_MAX_MS }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function unsealPanelChallengeJar(
  token: string | undefined,
): PanelJarPayload | null {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const payload = token.slice(0, cut);
  const sig = token.slice(cut + 1);
  const expected = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (
      !timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { j: PanelJarPayload; exp: number };
    if (
      !parsed?.j ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed.j;
  } catch {
    return null;
  }
}
