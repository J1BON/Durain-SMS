/**
 * Parse JSON from a fetch Response; avoid leaking SyntaxError when the body is HTML
 * (host error pages, upstream WAF, etc.).
 */
export async function readApiJson(res: Response): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty response from server");
  }
  const first = trimmed[0];
  if (first === "<" || trimmed.startsWith("<!")) {
    throw new Error(
      "The server returned a web page instead of data—often a short outage, a block, or a bad gateway. Refresh the page or try again in a minute.",
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      "The server response was not valid JSON. Refresh or check hosting logs if this continues.",
    );
  }
}
