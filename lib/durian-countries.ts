import type { CountryStock } from "./durian-api";
import { normalizeCountryCode, US_COUNTRY_CODE } from "./country-list";

export type DurianCountryRow = {
  code: string;
  stock: number;
  /** Present only for aggregated “any country” row (Durian getMobile without cuy). */
  label?: string;
};

/** Durian may use different keys for the same country across services. */
const US_ALIASES = new Set([
  "us",
  "usa",
  "unitedstates",
  "united-states",
  "united states",
  "1",
  /** ISO 3166-1 numeric — some Durian payloads use this for the US row */
  "840",
]);

/** Normalize country keys for US detection (dots, BOM, spacing). */
function collapseCountryKey(code: string): string {
  return code
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[_\s-]+/g, "");
}

export function isUsAlias(code: string): boolean {
  const trimmed = code.replace(/^\ufeff/, "").trim().toLowerCase();
  const collapsed = collapseCountryKey(code);

  if (collapsed === "us" || collapsed === "usa" || collapsed === "unitedstates") {
    return true;
  }
  /** "United States of America", "United States Minor …", etc. */
  if (collapsed.startsWith("unitedstates")) return true;
  if (trimmed === "840" || collapsed === "840") return true;
  if (trimmed === "1" || collapsed === "1") return true;
  /** Panel-style suffixes: us_sms, US-1 — avoid bare /^us/ (would match "ussr"). */
  if (/^us[_-][a-z0-9]{1,12}$/i.test(trimmed)) return true;

  return US_ALIASES.has(trimmed);
}

function mergeUsAliases(
  rows: { code: string; stock: number }[],
): { code: string; stock: number }[] {
  const byCode = new Map<string, { code: string; stock: number }>();
  let usStock = 0;
  let sawUsAlias = false;

  for (const row of rows) {
    if (isUsAlias(row.code)) {
      sawUsAlias = true;
      usStock = Math.max(usStock, row.stock);
      continue;
    }
    const code = normalizeCountryCode(row.code);
    if (code === "*") continue;
    const prev = byCode.get(code);
    byCode.set(code, {
      code,
      stock: prev ? Math.max(prev.stock, row.stock) : row.stock,
    });
  }

  /** Second pass: keys like "united states" that slipped through as a single normalized code */
  for (const [code, row] of [...byCode.entries()]) {
    if (code === US_COUNTRY_CODE) continue;
    if (!isUsAlias(row.code) && !isUsAlias(code)) continue;
    sawUsAlias = true;
    usStock = Math.max(usStock, row.stock);
    byCode.delete(code);
  }

  /** Always expose a `us` row when Durian sent any US-shaped key (even stock 0) so the dropdown matches the API. */
  if (sawUsAlias || usStock > 0) {
    byCode.set(US_COUNTRY_CODE, {
      code: US_COUNTRY_CODE,
      stock: usStock,
    });
  }

  return [...byCode.values()];
}

/**
 * Parse getCountryPhoneNum — codes and stock from Durian only.
 * Merges US aliases into a single `us` row. Adds `*` (sum of all country stock).
 */
export function parseDurianCountryStock(
  data: CountryStock | null | undefined,
): DurianCountryRow[] {
  const raw = Object.entries(data ?? {})
    .map(([code, stock]) => ({
      code: code.replace(/^\ufeff/, "").trim(),
      stock:
        typeof stock === "number" && !Number.isNaN(stock)
          ? stock
          : Number(stock) || 0,
    }))
    .filter((c) => {
      if (!c.code) return false;
      /** Keep positive stock for all countries, and keep US-shaped rows even at 0 (Durian often omits US otherwise). */
      if (c.stock > 0) return true;
      return isUsAlias(c.code) && c.stock >= 0;
    });

  const countries = mergeUsAliases(raw)
    .sort((a, b) => b.stock - a.stock);

  if (countries.length === 0) return [];

  const totalStock = countries.reduce((sum, c) => sum + c.stock, 0);

  return [
    { code: "*", stock: totalStock, label: "All countries" },
    ...countries,
  ];
}
