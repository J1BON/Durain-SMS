export const SESSION_COOKIE = "durain_site_session";
/** 1 year — session stays until explicit logout */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365;

type SessionPayload = {
  u: string;
  uid: string;
  role: "user" | "admin";
  exp: number;
};

function getSecret(): string {
  return (
    process.env.SITE_AUTH_SECRET?.trim() ||
    process.env.DURIAN_API_KEY?.trim() ||
    "durain-change-me-in-env"
  );
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bufferToBase64Url(sig);
}

export async function createSessionCookieValue(
  username: string,
  uid: string,
  role: "user" | "admin",
): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    uid,
    role,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = await hmacSign(body);
  return `${body}.${sig}`;
}

function base64UrlToString(base64url: string): string {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

/**
 * Full verification (HMAC + expiry). Use in server-side API routes / RSC.
 */
export async function verifySessionCookieValue(
  token: string | undefined,
): Promise<{ username: string; userId: string; role: "user" | "admin" } | null> {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(body);
  if (!timingSafeEqualStr(expected, sig)) return null;

  try {
    const payload = JSON.parse(base64UrlToString(body)) as SessionPayload;
    if (!payload.u || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return {
      username: payload.u,
      userId: payload.uid ?? payload.u,
      role: payload.role ?? "user",
    };
  } catch {
    return null;
  }
}

/**
 * Lightweight structural check for edge middleware (no HMAC key required).
 * Protected API routes re-run full HMAC verification server-side.
 */
export function verifySessionCookieShape(
  token: string | undefined,
): { username: string; userId: string; role: "user" | "admin" } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  try {
    const payload = JSON.parse(base64UrlToString(body)) as SessionPayload;
    if (!payload.u || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return {
      username: payload.u,
      userId: payload.uid ?? payload.u,
      role: payload.role ?? "user",
    };
  } catch {
    return null;
  }
}
