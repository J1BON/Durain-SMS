"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  LogOut,
  Smartphone,
  Star,
  Wallet,
} from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Service } from "@/lib/services";
import { useFavorites } from "@/lib/hooks/use-favorites";
import {
  formatCountdown,
  formatCredits,
  formatPhoneDisplay,
  formatSmsCodeDisplay,
  formatStock,
  phoneCopyValue,
  smsCodeCopyValue,
} from "@/lib/format";
import { useCountdown } from "@/lib/use-countdown";
import {
  buildCountryList,
  countryDisplayLabel,
  isCountryFavoriteCode,
  normalizeCountryCode,
  syncSelectedCountry,
} from "@/lib/country-list";

const POLL_INTERVAL_MS = 15_000;
const NUMBER_TTL_MS = 5 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 120;
const BALANCE_SYNC_MS = 30_000;
const COUNTRY_SYNC_MS = 45_000;
const SERVICE_SYNC_MS = 30 * 60 * 1000;

type Country = { code: string; stock: number; label?: string };

type Toast = { id: number; message: string };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [waitingSms, setWaitingSms] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [serialMode, setSerialMode] = useState<1 | 2>(2);
  const [orderSerial, setOrderSerial] = useState<1 | 2>(2);
  const [actionLoading, setActionLoading] = useState(false);
  const [numberExpiresAt, setNumberExpiresAt] = useState<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copiedField, setCopiedField] = useState<"phone" | "code" | null>(null);
  const [showFavoriteServices, setShowFavoriteServices] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [syncingServices, setSyncingServices] = useState(false);
  const [servicesHint, setServicesHint] = useState<string | null>(null);

  const {
    hydrated: favoritesReady,
    serviceIds: favoriteServiceIds,
    countryCodes: favoriteCountryCodes,
    toggleService: toggleFavoriteService,
    toggleCountry: toggleFavoriteCountry,
    isServiceFavorite,
    isCountryFavorite,
  } = useFavorites();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastId = useRef(0);
  const expiryNotified = useRef(false);
  const countryFetchGen = useRef(0);
  const countriesPidRef = useRef<number | null>(null);
  const favoriteCountryCodesRef = useRef(favoriteCountryCodes);
  const favoritesReadyRef = useRef(favoritesReady);
  const [countrySelectKey, setCountrySelectKey] = useState(0);

  useEffect(() => {
    favoriteCountryCodesRef.current = favoriteCountryCodes;
    favoritesReadyRef.current = favoritesReady;
  }, [favoriteCountryCodes, favoritesReady]);
  const secondsLeft = useCountdown(numberExpiresAt);

  const showToast = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const resetOrder = useCallback(() => {
    setPhoneNumber(null);
    setSmsCode(null);
    setWaitingSms(false);
    setPolling(false);
    setNumberExpiresAt(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedSearch(serviceSearch.trim().toLowerCase()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [serviceSearch]);

  const loadServices = useCallback(
    async (options?: { refresh?: boolean; quiet?: boolean }): Promise<number> => {
      if (!options?.quiet) {
        setLoadingServices(true);
      }

      try {
        const url = options?.refresh
          ? "/api/services?refresh=1"
          : "/api/services";
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body.error ?? "Failed to load services");
        }

        const list: Service[] = body.services ?? [];
        setServices(list);
        setServicesHint(
          list.length === 0 && typeof body.setupHint === "string"
            ? body.setupHint
            : null,
        );

        if (list.length > 0) {
          setSelectedService((prev) => {
            if (prev && list.some((s) => s.pid === prev.pid)) return prev;
            return prev;
          });
        }

        return list.length;
      } catch (e) {
        if (!options?.quiet) {
          setServicesHint(null);
          setError(e instanceof Error ? e.message : "Failed to load services");
          setServices([]);
          setSelectedService(null);
        }
        return 0;
      } finally {
        if (!options?.quiet) {
          setLoadingServices(false);
        }
      }
    },
    [],
  );

  const syncServicesFromDurian = useCallback(async () => {
    setSyncingServices(true);
    setError(null);
    try {
      const res = await fetch("/api/services/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to sync services from Durian");
      }
      showToast(`Synced ${body.count ?? 0} services`);
      await loadServices({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Service sync failed");
    } finally {
      setSyncingServices(false);
    }
  }, [loadServices, showToast]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const count = await loadServices();
      if (cancelled || count > 0) return;
      // Delay auto-sync so the page can render; user can also tap Sync manually.
      await new Promise((r) => setTimeout(r, 800));
      if (cancelled) return;
      await syncServicesFromDurian();
      if (!cancelled) await loadServices({ refresh: true });
    })();

    const id = setInterval(
      () => void loadServices({ refresh: true, quiet: true }),
      SERVICE_SYNC_MS,
    );

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadServices, syncServicesFromDurian]);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const body = await res.json();
      if (res.ok && typeof body.balance === "number") {
        setBalance(body.balance);
      }
    } catch {
      // balance sync is optional
    }
  }, []);

  useEffect(() => {
    void loadBalance();
    const id = setInterval(() => void loadBalance(), BALANCE_SYNC_MS);
    return () => clearInterval(id);
  }, [loadBalance]);

  const searchQuery = debouncedSearch;

  const filteredServices = useMemo(() => {
    if (!searchQuery) return [];
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery) ||
        String(s.pid).includes(searchQuery),
    );
  }, [services, searchQuery]);

  const favoriteServices = useMemo(() => {
    if (!favoritesReady) return [];
    return services.filter((s) => favoriteServiceIds.includes(s.pid));
  }, [services, favoriteServiceIds, favoritesReady]);

  const pickerServices = useMemo(() => {
    if (searchQuery) return filteredServices.slice(0, 100);
    if (favoriteServices.length > 0) return favoriteServices.slice(0, 50);
    return services.slice(0, 40);
  }, [searchQuery, filteredServices, favoriteServices, services]);

  const showServicePicker =
    servicePickerOpen || Boolean(searchQuery) || serviceSearch.trim().length > 0;

  useEffect(() => {
    if (loadingServices || selectedService || !favoritesReady) return;
    if (favoriteServices.length > 0) {
      setSelectedService(favoriteServices[0]);
      setShowFavoriteServices(true);
    }
  }, [loadingServices, selectedService, favoritesReady, favoriteServices]);

  const countryOptions = useMemo(
    () =>
      buildCountryList(
        countries,
        favoritesReady ? favoriteCountryCodes : [],
      ),
    [countries, favoriteCountryCodes, favoritesReady],
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!searchQuery || filteredServices.length === 0) return;
    if (filteredServices.some((s) => s.pid === selectedService?.pid)) return;
    setSelectedService(filteredServices[0]);
  }, [searchQuery, filteredServices, selectedService]);

  useEffect(() => {
    if (secondsLeft === 0 && phoneNumber && !smsCode && !expiryNotified.current) {
      expiryNotified.current = true;
      showToast("Number expired — release or get a new one");
    }
    if (secondsLeft !== 0 && secondsLeft !== null) {
      expiryNotified.current = false;
    }
  }, [secondsLeft, phoneNumber, smsCode, showToast]);

  const applyCountryList = useCallback(
    (
      list: Country[],
      pid: number,
      options?: { keepSelection?: boolean },
    ) => {
      const normalized = list.map((c) => ({
        ...c,
        code: normalizeCountryCode(c.code),
      }));

      countriesPidRef.current = pid;
      setCountries(normalized);

      const favCodes = favoritesReadyRef.current
        ? favoriteCountryCodesRef.current
        : [];
      const ordered = buildCountryList(normalized, favCodes);
      setSelectedCountry((prev) =>
        options?.keepSelection
          ? syncSelectedCountry(prev, ordered)
          : syncSelectedCountry("", ordered),
      );
    },
    [],
  );

  const loadCountries = useCallback(
    async (pid: number, options?: { quiet?: boolean }) => {
      const fetchGen = ++countryFetchGen.current;

      if (!options?.quiet) {
        setLoadingCountries(true);
        setError(null);
      }

      try {
        const res = await fetch(
          `/api/countries?pid=${pid}&_=${Date.now()}`,
          { cache: "no-store" },
        );
        const body = await res.json();

        if (fetchGen !== countryFetchGen.current) return;
        if (countriesPidRef.current !== pid) return;

        if (!res.ok) {
          throw new Error(body.error ?? "Failed to load countries");
        }

        const list: Country[] = body.countries ?? [];

        if (list.length === 0 && options?.quiet) {
          return;
        }

        applyCountryList(list, pid, { keepSelection: options?.quiet });
      } catch (e) {
        if (fetchGen !== countryFetchGen.current) return;
        if (!options?.quiet) {
          setError(e instanceof Error ? e.message : "Failed to load countries");
        }
      } finally {
        if (!options?.quiet) {
          setLoadingCountries(false);
        }
      }
    },
    [applyCountryList],
  );

  const selectedServicePid = selectedService?.pid ?? null;

  useEffect(() => {
    setSelectedCountry((prev) =>
      syncSelectedCountry(prev, countryOptions),
    );
  }, [countryOptions]);

  useEffect(() => {
    if (!selectedServicePid) {
      setCountries([]);
      setSelectedCountry("");
      return;
    }

    countryFetchGen.current += 1;
    countriesPidRef.current = selectedServicePid;
    setCountries([]);
    setSelectedCountry("");
    setCountrySelectKey((k) => k + 1);
    resetOrder();
    void loadCountries(selectedServicePid);
  }, [selectedServicePid, loadCountries, resetOrder]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !selectedServicePid) {
        return;
      }
      void loadCountries(selectedServicePid, { quiet: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [selectedServicePid, loadCountries]);

  useEffect(() => {
    if (!selectedServicePid || loadingNumber || phoneNumber) return;
    const id = setInterval(
      () => void loadCountries(selectedServicePid, { quiet: true }),
      COUNTRY_SYNC_MS,
    );
    return () => clearInterval(id);
  }, [selectedServicePid, loadingNumber, phoneNumber, loadCountries]);

  const checkSms = useCallback(async () => {
    if (!phoneNumber) return;

    setPolling(true);
    try {
      const params = new URLSearchParams({
        pn: phoneNumber,
        pid: String(selectedService!.pid),
        serial: String(orderSerial),
      });
      const res = await fetch(`/api/checkSms?${params}`);
      const body = await res.json();

      if (res.status === 202 || body.pending) {
        setWaitingSms(true);
        return;
      }

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to check SMS");
      }

      if (body.code) {
        const code = smsCodeCopyValue(String(body.code));
        setSmsCode(code);
        setWaitingSms(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        void copyText(code).then((ok) => {
          if (ok) {
            setCopiedField("code");
            showToast("Code received and copied");
            setTimeout(() => setCopiedField(null), 2000);
          }
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "SMS check failed");
    } finally {
      setPolling(false);
    }
  }, [phoneNumber, selectedService, orderSerial, showToast]);

  useEffect(() => {
    if (!phoneNumber || smsCode) return;

    setWaitingSms(true);
    void checkSms();

    pollRef.current = setInterval(() => {
      void checkSms();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phoneNumber, smsCode, checkSms]);

  const handleGetNumber = async () => {
    if (!selectedService) {
      setError("Please select a service");
      return;
    }

    const cuy = countryOptions.some((c) => c.code === selectedCountry)
      ? selectedCountry
      : "";
    if (!cuy) {
      setError("Please select a country");
      return;
    }

    setLoadingNumber(true);
    setError(null);
    resetOrder();
    const serial = selectedService.serial ?? serialMode;
    setOrderSerial(serial === 1 ? 1 : 2);

    try {
      const params = new URLSearchParams({
        pid: String(selectedService.pid),
        serial: String(serial === 1 ? 1 : 2),
      });
      if (cuy !== "*") {
        params.set("cuy", cuy);
      }
      if (secretKey.trim()) {
        params.set("secret_key", secretKey.trim());
      }

      const res = await fetch(`/api/getNumber?${params}`);
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to get number");
      }

      setPhoneNumber(body.phoneNumber);
      setNumberExpiresAt(Date.now() + NUMBER_TTL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get number");
    } finally {
      setLoadingNumber(false);
    }
  };

  const handleRelease = async () => {
    if (!phoneNumber || !selectedService) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pn: phoneNumber,
          pid: selectedService.pid,
          serial: orderSerial,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Release failed");
      showToast("Number released");
      resetOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlacklist = async () => {
    if (!phoneNumber || !selectedService) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pn: phoneNumber,
          pid: selectedService.pid,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Blacklist failed");
      showToast("Number blacklisted");
      resetOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Blacklist failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async (
    raw: string,
    label: string,
    field: "phone" | "code",
  ) => {
    const text = field === "phone" ? phoneCopyValue(raw) : smsCodeCopyValue(raw);
    const ok = await copyText(text);
    if (ok) {
      setCopiedField(field);
      showToast(`${label} copied`);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      setError("Could not copy to clipboard");
    }
  };

  const phoneDisplay = phoneNumber ? formatPhoneDisplay(phoneNumber) : "";
  const codeDisplay = smsCode ? formatSmsCodeDisplay(smsCode) : "";

  /** Locked while an active phone order is in progress */
  const orderLocked = loadingNumber || Boolean(phoneNumber);
  const canPickService = !orderLocked && !loadingServices;

  const activeCountryCode = countryOptions.some((c) => c.code === selectedCountry)
    ? selectedCountry
    : "";

  const canSubmitOrder =
    !orderLocked &&
    !loadingServices &&
    Boolean(selectedService) &&
    Boolean(activeCountryCode) &&
    countryOptions.length > 0 &&
    !(loadingCountries && countryOptions.length === 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 sm:py-10">
      {/* Header */}
      <header className="relative mb-8 text-center">
        <ThemeToggle className="absolute left-0 top-0" />
        <button
          type="button"
          className="btn btn-ghost btn-sm absolute right-0 top-0 rounded-lg text-base-content/50"
          aria-label="Log out"
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <MessageSquare className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-base-content">
          Durain SMS-J1BON
        </h1>
        <p className="mt-1 text-sm text-base-content/60">
          Clean verification codes, easy money💸💸
        </p>
        {balance !== null && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-3 py-1 text-sm font-medium text-base-content">
            <Wallet className="h-4 w-4 text-primary" />
            {formatCredits(balance)} credits
          </p>
        )}
      </header>

      {/* Form card */}
      <section className="card border border-base-300/80 bg-base-100 shadow-sm">
        <div className="card-body gap-5 p-5 sm:p-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-base-content/50">
            New order
          </h2>

          {/* Service */}
          <div className="form-control w-full">
            <div className="label flex-wrap gap-2 py-0 pb-2">
              <label className="label-text text-sm font-medium" htmlFor="service-search">
                Service
              </label>
              <div className="flex items-center gap-2">
                {!loadingServices && favoriteServices.length > 0 && (
                  <button
                    type="button"
                    className={`btn btn-xs rounded-lg ${
                      showFavoriteServices ? "btn-warning" : "btn-ghost"
                    }`}
                    onClick={() => setShowFavoriteServices((v) => !v)}
                  >
                    <Star
                      className="h-3 w-3"
                      fill={showFavoriteServices ? "currentColor" : "none"}
                    />
                    Favorites ({favoriteServices.length})
                  </button>
                )}
                {!loadingServices && services.length > 0 && (
                  <span className="label-text-alt text-base-content/50">
                    {searchQuery
                      ? `${filteredServices.length} of ${services.length} match`
                      : `${services.length} available`}
                  </span>
                )}
              </div>
            </div>
            <div className="relative mb-2 flex gap-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
              <input
                id="service-search"
                type="search"
                placeholder="Search by name (e.g. Microsoft, Amazon)…"
                className="input input-bordered min-w-0 flex-1 rounded-xl border-base-300 bg-base-100 pl-10 text-base focus:outline-none focus:border-primary/40"
                value={serviceSearch}
                disabled={!canPickService}
                onFocus={() => setServicePickerOpen(true)}
                onBlur={() => {
                  setTimeout(() => setServicePickerOpen(false), 150);
                }}
                onChange={(e) => {
                  setServiceSearch(e.target.value);
                  setServicePickerOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredServices[0]) {
                    e.preventDefault();
                    setSelectedService(filteredServices[0]);
                    setServiceSearch("");
                  }
                }}
              />
              {selectedService && (
                <FavoriteButton
                  active={isServiceFavorite(selectedService.pid)}
                  label={
                    isServiceFavorite(selectedService.pid)
                      ? "Remove service from favorites"
                      : "Add service to favorites"
                  }
                  disabled={!canPickService}
                  onToggle={() => {
                    const wasFav = isServiceFavorite(selectedService.pid);
                    toggleFavoriteService(selectedService.pid);
                    showToast(
                      wasFav ? "Removed from favorites" : "Added to favorites",
                    );
                  }}
                />
              )}
            </div>
            {showFavoriteServices &&
              !serviceSearch.trim() &&
              !loadingServices && (
                <ul className="mb-2 max-h-40 overflow-y-auto rounded-xl border border-warning/30 bg-warning/5">
                  {favoriteServices.map((s) => (
                    <li key={s.pid}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-base-200 ${
                          selectedService?.pid === s.pid ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedService(s)}
                      >
                        <FavoriteButton
                          active
                          label="Remove from favorites"
                          onToggle={() => toggleFavoriteService(s.pid)}
                        />
                        <span className="min-w-0 flex-1 font-medium">{s.name}</span>
                        <span className="shrink-0 text-xs text-base-content/50">
                          ID {s.pid}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            {showServicePicker && !loadingServices && !syncingServices && (
              <ul
                className="mb-2 max-h-52 overflow-y-auto rounded-xl border border-base-300 bg-base-100 shadow-sm"
                role="listbox"
                aria-label="Search results"
              >
                {!searchQuery && favoriteServices.length === 0 && (
                  <li className="border-b border-base-300 px-3 py-2 text-xs text-base-content/50">
                    Popular services — type to search all {services.length}
                  </li>
                )}
                {services.length === 0 ? (
                  <li className="space-y-2 px-3 py-3 text-sm text-base-content/60">
                    <p>Service list not loaded yet.</p>
                    {servicesHint && <p className="text-xs">{servicesHint}</p>}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm rounded-lg"
                      disabled={syncingServices}
                      onClick={() => void syncServicesFromDurian()}
                    >
                      {syncingServices ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Syncing…
                        </>
                      ) : (
                        "Sync services from Durian"
                      )}
                    </button>
                  </li>
                ) : searchQuery && filteredServices.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-base-content/50">
                    No services match &ldquo;{serviceSearch.trim()}&rdquo;
                  </li>
                ) : (
                  pickerServices.map((s) => (
                    <li
                      key={s.pid}
                      role="option"
                      aria-selected={selectedService?.pid === s.pid}
                    >
                      <div className="flex w-full items-center gap-1">
                        <button
                          type="button"
                          className={`min-w-0 flex-1 px-2 py-2.5 text-left text-sm hover:bg-base-200 ${
                            selectedService?.pid === s.pid ? "bg-primary/10" : ""
                          }`}
                          onClick={() => {
                            setSelectedService(s);
                            setServiceSearch("");
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-base-content/50">
                            ID {s.pid}
                            {s.cost != null ? ` · ${s.cost} cr` : ""}
                          </span>
                        </button>
                        <FavoriteButton
                          active={isServiceFavorite(s.pid)}
                          label={
                            isServiceFavorite(s.pid)
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                          onToggle={() => toggleFavoriteService(s.pid)}
                        />
                      </div>
                    </li>
                  ))
                )}
                {searchQuery && filteredServices.length > 100 && (
                  <li className="border-t border-base-300 px-3 py-2 text-xs text-base-content/50">
                    Showing 100 of {filteredServices.length} matches — refine your search
                  </li>
                )}
              </ul>
            )}
            {!loadingServices && services.length === 0 && servicesHint && (
              <div className="alert alert-warning mt-2 rounded-xl py-3 text-sm shadow-none">
                <span>{servicesHint}</span>
              </div>
            )}
            {!loadingServices && services.length === 0 && (
              <button
                type="button"
                className="btn btn-outline btn-sm mt-2 w-full rounded-xl"
                disabled={syncingServices}
                onClick={() => void syncServicesFromDurian()}
              >
                {syncingServices ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing from Durian…
                  </>
                ) : (
                  "Sync services from Durian"
                )}
              </button>
            )}
            {!loadingServices && services.length > 0 && (
              <div className="relative mt-1">
                <select
                  className="select select-bordered select-sm w-full rounded-xl border-base-300 text-sm"
                  value={selectedService?.pid ?? ""}
                  disabled={!canPickService}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    if (!pid) {
                      setSelectedService(null);
                      return;
                    }
                    const svc = services.find((s) => s.pid === pid);
                    if (svc) setSelectedService(svc);
                  }}
                >
                  <option value="">Or browse from list…</option>
                  {favoriteServices.length > 0 && (
                    <optgroup label="★ Favorites">
                      {favoriteServices.map((s) => (
                        <option key={`sel-fav-${s.pid}`} value={s.pid}>
                          {s.name} · {s.pid}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Services">
                    {(searchQuery
                      ? filteredServices.slice(0, 200)
                      : services.slice(0, 200)
                    ).map((s) => (
                      <option key={`sel-${s.pid}`} value={s.pid}>
                        {s.name} · {s.pid}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
              </div>
            )}
            {selectedService && !searchQuery && (
              <p className="mb-2 text-sm text-base-content/70">
                Selected:{" "}
                <span className="font-medium text-base-content">
                  {selectedService.name}
                </span>
                <span className="text-base-content/50">
                  {" "}
                  · ID {selectedService.pid}
                  {selectedService.cost != null
                    ? ` · ${selectedService.cost} credits`
                    : ""}
                </span>
              </p>
            )}
            {!selectedService && !loadingServices && (
              <p className="mb-2 text-sm text-amber-700/80">
                Tap the search box to pick a service, or use the list below.
              </p>
            )}
            {loadingServices && (
              <p className="mt-2 flex items-center gap-2 text-xs text-base-content/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading services from DurianRCS…
              </p>
            )}
          </div>

          {/* Secret key + message mode */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="form-control">
              <label className="label py-0 pb-2" htmlFor="secret-key">
                <span className="label-text text-sm font-medium">Secret key</span>
                <span className="label-text-alt text-base-content/50">Optional</span>
              </label>
              <input
                id="secret-key"
                type="text"
                placeholder="Optional"
                className="input input-bordered w-full rounded-xl border-base-300"
                value={secretKey}
                disabled={orderLocked}
                onChange={(e) => setSecretKey(e.target.value)}
              />
            </div>
            <div className="form-control">
              <span className="label py-0 pb-2">
                <span className="label-text text-sm font-medium">Message mode</span>
              </span>
              <div className="flex gap-4 rounded-xl border border-base-300 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="serial"
                    className="radio radio-primary radio-sm"
                    checked={serialMode === 2}
                    disabled={orderLocked}
                    onChange={() => setSerialMode(2)}
                  />
                  Single
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="serial"
                    className="radio radio-primary radio-sm"
                    checked={serialMode === 1}
                    disabled={orderLocked}
                    onChange={() => setSerialMode(1)}
                  />
                  Multiple
                </label>
              </div>
            </div>
          </div>

          {/* Country */}
          <div className="form-control w-full">
            <label className="label flex-wrap gap-2 py-0 pb-2" htmlFor="country">
              <span className="label-text text-sm font-medium">Country</span>
              {selectedCountry && selectedCountry !== "*" && (
                <span className="label-text-alt text-base-content/50">
                  {isCountryFavorite(selectedCountry) ? "★ Favorite" : "Tap ★ to save"}
                </span>
              )}
            </label>
            <div className="flex gap-1">
              <div className="relative min-w-0 flex-1">
              <select
                key={`country-${selectedServicePid ?? "none"}-${countrySelectKey}`}
                id="country"
                className="select select-bordered w-full appearance-none rounded-xl border-base-300 bg-base-100 pr-10 text-base focus:outline-none focus:border-primary/40 disabled:opacity-50"
                value={
                  countryOptions.some((c) => c.code === selectedCountry)
                    ? selectedCountry
                    : ""
                }
                disabled={
                  orderLocked ||
                  !selectedService ||
                  (loadingCountries && countryOptions.length === 0) ||
                  countryOptions.length === 0
                }
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                {loadingCountries && countryOptions.length === 0 && (
                  <option value="">Loading countries…</option>
                )}
                {!loadingCountries && countryOptions.length === 0 && (
                  <option value="">No stock available</option>
                )}
                {countryOptions.map((c) => {
                  const starred =
                    favoritesReady &&
                    isCountryFavoriteCode(c.code, favoriteCountryCodes);
                  return (
                    <option key={c.code} value={c.code}>
                      {starred ? "★ " : ""}
                      {countryDisplayLabel(c)} · {formatStock(c.stock)} in stock
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
              </div>
              {selectedCountry && selectedCountry !== "*" && (
                <FavoriteButton
                  active={isCountryFavorite(selectedCountry)}
                  label={
                    isCountryFavorite(selectedCountry)
                      ? "Remove country from favorites"
                      : "Add country to favorites"
                  }
                  disabled={orderLocked || loadingCountries || !selectedService}
                  onToggle={() => {
                    const wasFav = isCountryFavorite(selectedCountry);
                    toggleFavoriteCountry(selectedCountry);
                    showToast(
                      wasFav
                        ? "Country removed from favorites"
                        : "Country saved to favorites",
                    );
                  }}
                />
              )}
            </div>
          </div>

          {error && (
            <div className="alert alert-error rounded-xl py-3 text-sm shadow-none">
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary h-12 w-full rounded-xl text-base font-medium shadow-sm"
            disabled={!canSubmitOrder || loadingNumber}
            onClick={() => void handleGetNumber()}
          >
            {loadingNumber ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Getting number…
              </>
            ) : (
              <>
                <Smartphone className="h-5 w-5" />
                Get Number
              </>
            )}
          </button>

          {phoneNumber && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm flex-1 rounded-xl border-base-300"
                disabled={actionLoading}
                onClick={() => void handleRelease()}
              >
                <RotateCcw className="h-4 w-4" />
                Release
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm flex-1 rounded-xl border-warning/40 text-warning"
                disabled={actionLoading}
                onClick={() => void handleBlacklist()}
              >
                <Ban className="h-4 w-4" />
                Blacklist
              </button>
            </div>
          )}

          {phoneNumber && !smsCode && (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-lg text-base-content/60"
              onClick={() => {
                resetOrder();
                setError(null);
              }}
            >
              Start over
            </button>
          )}
        </div>
      </section>

      {/* Active order */}
      {phoneNumber && (
        <section className="card mt-5 border border-base-300/80 bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-widest text-base-content/50">
                Active order
              </h2>
              <div className="flex items-center gap-3 text-xs text-base-content/60">
                {secondsLeft != null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${
                      secondsLeft <= 60
                        ? "bg-warning/15 text-warning"
                        : "bg-base-200"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {formatCountdown(secondsLeft)}
                  </span>
                )}
                {waitingSms && !smsCode && (
                  <span className="inline-flex items-center gap-2">
                    {polling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <span className="pulse-dot" aria-hidden />
                    )}
                    Waiting…
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm text-base-content/50">Phone number</p>
              <p className="phone-display text-2xl font-bold text-base-content sm:text-[1.75rem]">
                {phoneDisplay}
              </p>
              <p className="mt-1 text-xs text-base-content/40 tabular-nums">
                {phoneCopyValue(phoneNumber)}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline h-11 w-full gap-2 rounded-xl border-base-300 font-medium"
              onClick={() => void handleCopy(phoneNumber, "Number", "phone")}
            >
              {copiedField === "phone" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedField === "phone" ? "Copied" : "Copy number"}
            </button>

            {smsCode && (
              <>
                <div className="divider my-1 text-base-content/30">code</div>
                <div>
                  <p className="mb-2 text-sm text-base-content/50">
                    Verification code
                  </p>
                  <p className="code-display text-center text-4xl font-bold text-primary sm:text-5xl">
                    {codeDisplay}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary h-12 w-full gap-2 rounded-xl text-base font-medium"
                  onClick={() => void handleCopy(smsCode, "Code", "code")}
                >
                  {copiedField === "code" ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                  {copiedField === "code" ? "Copied" : "Copy code"}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Toasts */}
      <div className="toast toast-top toast-center z-50 w-full max-w-md px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="alert flex w-full justify-center rounded-xl border border-base-300 bg-base-100 py-3 shadow-lg"
          >
            <Check className="h-4 w-4 shrink-0 text-success" />
            <span className="text-sm font-medium">{t.message}</span>
          </div>
        ))}
      </div>

      <footer className="mt-auto pt-10 text-center text-xs text-base-content/40">
        Secured via server proxy · Keys never exposed
      </footer>
    </div>
  );
}
