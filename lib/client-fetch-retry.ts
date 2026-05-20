/**
 * Browser fetch with short retries — helps Render cold starts and flaky mobile networks.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; backoffMs?: number },
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const backoffMs = options?.backoffMs ?? 500;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, { ...init, cache: "no-store" });
    } catch (e) {
      last = e;
      if (attempt === retries) break;
      await new Promise((r) =>
        setTimeout(r, backoffMs * (attempt + 1)),
      );
    }
  }
  throw last;
}

export function isBrowserNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes("failed to fetch") ||
      m.includes("networkerror") ||
      m.includes("load failed") ||
      m.includes("network request failed")
    );
  }
  return false;
}
