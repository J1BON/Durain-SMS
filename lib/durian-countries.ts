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
]);

function isUsAlias(code: string): boolean {
  const norm = code.trim().toLowerCase().replace(/[_\s-]+/g, "");
  if (norm === "us" || norm === "usa" || norm === "unitedstates") return true;
  return US_ALIASES.has(code.trim().toLowerCase());
}

function mergeUsAliases(
  rows: { code: string; stock: number }[],
): { code: string; stock: number }[] {
  const byCode = new Map<string, { code: string; stock: number }>();
  let usStock = 0;

  for (const row of rows) {
    if (isUsAlias(row.code)) {
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

  if (usStock > 0) {
    byCode.set(US_COUNTRY_CODE, { code: US_COUNTRY_CODE, stock: usStock });
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
      code: code.trim(),
      stock: typeof stock === "number" ? stock : Number(stock) || 0,
    }))
    .filter((c) => c.code && c.stock > 0);

  const countries = mergeUsAliases(raw)
    .sort((a, b) => b.stock - a.stock);

  if (countries.length === 0) return [];

  const totalStock = countries.reduce((sum, c) => sum + c.stock, 0);

  return [
    { code: "*", stock: totalStock, label: "All countries" },
    ...countries,
  ];
}
