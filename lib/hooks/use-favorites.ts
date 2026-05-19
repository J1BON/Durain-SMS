"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeCountryCode } from "@/lib/country-list";

const SERVICE_KEY = "durain_fav_services";
const COUNTRY_KEY = "durain_fav_countries";

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCountryFavorites(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of readJsonArray<string>(COUNTRY_KEY)) {
    const norm = normalizeCountryCode(code);
    if (norm === "*" || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

export function useFavorites() {
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setServiceIds(readJsonArray<number>(SERVICE_KEY));
    const codes = readCountryFavorites();
    setCountryCodes(codes);
    if (codes.length > 0) {
      localStorage.setItem(COUNTRY_KEY, JSON.stringify(codes));
    }
    setHydrated(true);
  }, []);

  const toggleService = useCallback((pid: number) => {
    setServiceIds((prev) => {
      const next = prev.includes(pid)
        ? prev.filter((id) => id !== pid)
        : [...prev, pid];
      localStorage.setItem(SERVICE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleCountry = useCallback((code: string) => {
    const norm = normalizeCountryCode(code);
    if (norm === "*") return;
    setCountryCodes((prev) => {
      const next = prev.includes(norm)
        ? prev.filter((c) => c !== norm)
        : [...prev, norm];
      localStorage.setItem(COUNTRY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isServiceFavorite = useCallback(
    (pid: number) => serviceIds.includes(pid),
    [serviceIds],
  );

  const isCountryFavorite = useCallback(
    (code: string) => countryCodes.includes(normalizeCountryCode(code)),
    [countryCodes],
  );

  return {
    hydrated,
    serviceIds,
    countryCodes,
    toggleService,
    toggleCountry,
    isServiceFavorite,
    isCountryFavorite,
  };
}
