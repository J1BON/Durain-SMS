export type CountryOption = { code: string; stock: number; label?: string };

export const US_COUNTRY_CODE = "us";

export function normalizeCountryCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed === "*") return "*";
  return trimmed.toLowerCase();
}

export function countryDisplayLabel(c: CountryOption): string {
  if (c.label) return c.label;
  if (c.code === "*") return "All countries";
  if (c.code === US_COUNTRY_CODE) return "USA";
  return c.code.toUpperCase();
}

/**
 * Single ordered list for the country dropdown (no duplicate optgroups).
 * Order: All countries → USA (when in API data) → favorites → rest by stock.
 */
export function buildCountryList(
  countries: CountryOption[],
  favoriteCodes: string[],
): CountryOption[] {
  const byCode = new Map<string, CountryOption>();

  for (const c of countries) {
    const code = normalizeCountryCode(c.code);
    byCode.set(code, { ...c, code });
  }

  const favOrder = favoriteCodes
    .map(normalizeCountryCode)
    .filter((code) => code !== "*");

  const favSet = new Set(favOrder);
  const favoriteRows: CountryOption[] = [];
  for (const code of favOrder) {
    const row = byCode.get(code);
    if (row) favoriteRows.push(row);
  }

  const allCountries = byCode.get("*");
  const us = byCode.get(US_COUNTRY_CODE);

  const pinned = new Set<string>();
  if (allCountries) pinned.add("*");
  if (us) pinned.add(US_COUNTRY_CODE);
  for (const code of favSet) pinned.add(code);

  const rest = [...byCode.values()]
    .filter((c) => !pinned.has(c.code))
    .sort((a, b) => b.stock - a.stock);

  const ordered: CountryOption[] = [];
  if (allCountries) ordered.push(allCountries);
  if (us) ordered.push(us);

  for (const row of favoriteRows) {
    if (!ordered.some((c) => c.code === row.code)) {
      ordered.push(row);
    }
  }

  ordered.push(...rest);
  return ordered;
}

export function isCountryFavoriteCode(
  code: string,
  favoriteCodes: string[],
): boolean {
  const norm = normalizeCountryCode(code);
  if (norm === "*") return false;
  return favoriteCodes.map(normalizeCountryCode).includes(norm);
}

/** Prefer USA when in stock, then All countries, then first with stock. */
export function defaultCountryCode(ordered: CountryOption[]): string {
  const us = ordered.find((c) => c.code === US_COUNTRY_CODE && c.stock > 0);
  if (us) return us.code;
  const all = ordered.find((c) => c.code === "*");
  if (all) return all.code;
  const withStock = ordered.find((c) => c.stock > 0);
  return withStock?.code ?? ordered[0]?.code ?? "";
}

export function countryCodeInList(
  code: string,
  ordered: CountryOption[],
): boolean {
  const norm = normalizeCountryCode(code);
  return ordered.some((c) => c.code === norm);
}

export function syncSelectedCountry(
  current: string,
  ordered: CountryOption[],
): string {
  if (current && countryCodeInList(current, ordered)) return current;
  return defaultCountryCode(ordered);
}
