"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
  XCircle,
  Check,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { countryDisplayLabel, normalizeCountryCode } from "@/lib/country-list";

interface UserStats {
  userId: string;
  username: string;
  smsReceived: number;
  numbersReleased: number;
  totalAssigned: number;
}

interface DailyUserStats {
  date: string;
  userId: string;
  username: string;
  smsReceived: number;
  numbersReleased: number;
  totalAssigned: number;
}

interface UserInfo {
  id: string;
  username: string;
  password: string;
  role: string;
}

interface RecentEntry {
  id: string;
  userId: string;
  username: string;
  phoneNumber: string;
  pid: string;
  country: string;
  assignedAt: number;
  receivedSms: boolean;
  released: boolean;
  smsCode?: string;
}

interface StatsData {
  users: UserInfo[];
  stats: UserStats[];
  dailyStats: DailyUserStats[];
  reportDays: number;
  recent: RecentEntry[];
}

interface LockedSetting {
  pid: number;
  name: string;
  country: string;
}

interface ServiceItem {
  pid: number;
  name: string;
  cost?: number;
}

interface CountryItem {
  code: string;
  stock: number;
}

interface EditState {
  id: string;
  username: string;
  password: string;
  role: string;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatReportDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const REPORT_DAY_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
] as const;

/** Auto-refresh daily report + recent activity while admin tab is open. */
const ADMIN_STATS_REFRESH_MS = 15_000;

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ id: "", username: "", password: "", role: "user" });
  const [editError, setEditError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add user state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addUsernameRef = useRef<HTMLInputElement>(null);

  // Lock settings state
  const [currentLock, setCurrentLock] = useState<LockedSetting | null>(null);
  const [lockServices, setLockServices] = useState<ServiceItem[]>([]);
  const [lockCountries, setLockCountries] = useState<CountryItem[]>([]);
  const [lockServiceSearch, setLockServiceSearch] = useState("");
  const [debouncedLockServiceSearch, setDebouncedLockServiceSearch] = useState("");
  const [lockServicePickerOpen, setLockServicePickerOpen] = useState(false);
  const [lockCountrySearch, setLockCountrySearch] = useState("");
  const [lockSelectedPid, setLockSelectedPid] = useState<number | null>(null);
  const [lockSelectedName, setLockSelectedName] = useState("");
  const [lockSelectedCountry, setLockSelectedCountry] = useState("");
  const [lockServicesLoading, setLockServicesLoading] = useState(false);
  const [lockSyncingServices, setLockSyncingServices] = useState(false);
  const [lockCountriesLoading, setLockCountriesLoading] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showLockForm, setShowLockForm] = useState(false);
  const [reportDays, setReportDays] = useState(30);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [statsRefreshing, setStatsRefreshing] = useState(false);

  const fetchStats = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet ?? false;
      if (!quiet) {
        setLoading(true);
        setError(null);
      } else {
        setStatsRefreshing(true);
      }
      try {
        const res = await fetch(`/api/admin/stats?days=${reportDays}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403) {
            router.replace("/");
            return;
          }
          throw new Error("Failed to load stats");
        }
        setData((await res.json()) as StatsData);
        setLastRefreshedAt(Date.now());
        if (quiet) setError(null);
      } catch (err) {
        if (!quiet) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!quiet) setLoading(false);
        else setStatsRefreshing(false);
      }
    },
    [router, reportDays],
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void fetchStats({ quiet: true });
    };
    const id = setInterval(tick, ADMIN_STATS_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchStats({ quiet: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchStats]);

  const loadLockServices = useCallback(async (refresh = false) => {
    setLockServicesLoading(true);
    try {
      const url = refresh ? "/api/services?refresh=1" : "/api/services";
      const res = await fetch(url);
      const json = (await res.json()) as { services?: ServiceItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load services");
      setLockServices(json.services ?? []);
    } catch {
      setLockServices([]);
    } finally {
      setLockServicesLoading(false);
    }
  }, []);

  // Load current lock + services on mount
  useEffect(() => {
    void (async () => {
      try {
        const settRes = await fetch("/api/admin/settings");
        const settJson = (await settRes.json()) as { lock: LockedSetting | null };
        setCurrentLock(settJson.lock ?? null);
      } catch {
        // non-fatal
      }
      void loadLockServices();
    })();
  }, [loadLockServices]);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedLockServiceSearch(lockServiceSearch.trim().toLowerCase()),
      200,
    );
    return () => clearTimeout(t);
  }, [lockServiceSearch]);

  const selectLockService = (svc: ServiceItem) => {
    setLockSelectedPid(svc.pid);
    setLockSelectedName(svc.name);
    setLockServiceSearch("");
    setDebouncedLockServiceSearch("");
    setLockServicePickerOpen(false);
    setLockCountrySearch("");
  };

  // Load countries when a service is selected in the lock form
  useEffect(() => {
    if (!lockSelectedPid) {
      setLockCountries([]);
      setLockSelectedCountry("");
      return;
    }
    setLockCountriesLoading(true);
    fetch(`/api/countries?pid=${lockSelectedPid}`)
      .then((r) => r.json())
      .then((d: { countries?: CountryItem[] }) => {
        const list = (d.countries ?? []).map((c) => ({
          ...c,
          code: normalizeCountryCode(c.code),
        }));
        setLockCountries(list);
        setLockSelectedCountry((prev) => {
          if (prev && list.some((c) => c.code === prev)) return prev;
          return list[0]?.code ?? "";
        });
      })
      .catch(() => setLockCountries([]))
      .finally(() => setLockCountriesLoading(false));
  }, [lockSelectedPid]);

  const handleSaveLock = async () => {
    if (!lockSelectedPid || !lockSelectedName || !lockSelectedCountry) {
      setLockError("Select a service and country first");
      return;
    }
    setLockSaving(true);
    setLockError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock: { pid: lockSelectedPid, name: lockSelectedName, country: lockSelectedCountry } }),
      });
      if (!res.ok) { setLockError("Failed to save"); return; }
      setCurrentLock({ pid: lockSelectedPid, name: lockSelectedName, country: lockSelectedCountry });
      setShowLockForm(false);
    } catch { setLockError("Network error"); }
    finally { setLockSaving(false); }
  };

  const handleClearLock = async () => {
    setLockSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock: null }),
      });
      setCurrentLock(null);
      setShowLockForm(false);
    } catch { /* ignore */ }
    finally { setLockSaving(false); }
  };

  const lockServiceQuery = debouncedLockServiceSearch;

  const filteredLockServices = useMemo(() => {
    if (!lockServiceQuery) return [];
    return lockServices
      .filter(
        (s) =>
          s.name.toLowerCase().includes(lockServiceQuery) ||
          String(s.pid).includes(lockServiceQuery),
      )
      .slice(0, 100);
  }, [lockServices, lockServiceQuery]);

  const lockPickerServices = useMemo(() => {
    if (lockServiceQuery) return filteredLockServices;
    return lockServices.slice(0, 80);
  }, [lockServiceQuery, filteredLockServices, lockServices]);

  const showLockServicePicker =
    lockServicePickerOpen ||
    lockServiceSearch.trim().length > 0 ||
    Boolean(lockServiceQuery);

  const filteredLockCountries = useMemo(() => {
    const q = lockCountrySearch.trim().toLowerCase();
    if (!q) return lockCountries;
    return lockCountries.filter((c) => {
      const label = countryDisplayLabel(c).toLowerCase();
      return c.code.toLowerCase().includes(q) || label.includes(q);
    });
  }, [lockCountries, lockCountrySearch]);

  const openLockForm = () => {
    setShowLockForm(true);
    setLockError(null);
    setLockServiceSearch("");
    setDebouncedLockServiceSearch("");
    setLockCountrySearch("");
    setLockServicePickerOpen(false);
    if (currentLock) {
      setLockSelectedPid(currentLock.pid);
      setLockSelectedName(currentLock.name);
      setLockSelectedCountry(normalizeCountryCode(currentLock.country));
    } else {
      setLockSelectedPid(null);
      setLockSelectedName("");
      setLockSelectedCountry("");
    }
    if (lockServices.length === 0) void loadLockServices();
  };

  useEffect(() => {
    if (showAddForm) setTimeout(() => addUsernameRef.current?.focus(), 50);
  }, [showAddForm]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  // --- Edit ---
  const startEdit = (u: UserInfo) => {
    setEditingId(u.id);
    setEditState({ id: u.id, username: u.username, password: u.password, role: u.role });
    setEditError(null);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const saveEdit = async () => {
    if (!editState.username.trim() || !editState.password.trim()) {
      setEditError("Username and password cannot be empty");
      return;
    }
    setSavingId(editState.id);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setEditError(json.error ?? "Save failed"); return; }
      setEditingId(null);
      await fetchStats({ quiet: true });
    } catch {
      setEditError("Network error");
    } finally {
      setSavingId(null);
    }
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Delete failed"); return; }
      await fetchStats({ quiet: true });
    } catch {
      setError("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  // --- Add ---
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setAddError("Username and password are required");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setAddError(json.error ?? "Add failed"); return; }
      setNewUser({ username: "", password: "", role: "user" });
      setShowAddForm(false);
      await fetchStats({ quiet: true });
    } catch {
      setAddError("Network error");
    } finally {
      setAdding(false);
    }
  };

  const totalSms = data?.stats.reduce((s, u) => s + u.smsReceived, 0) ?? 0;
  const totalReleased = data?.stats.reduce((s, u) => s + u.numbersReleased, 0) ?? 0;
  const totalAssigned = data?.stats.reduce((s, u) => s + u.totalAssigned, 0) ?? 0;

  return (
    <div className="min-h-dvh bg-base-200/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-base-300 bg-base-100/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <span className="font-semibold">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-xs text-base-content/45 sm:inline">
              {lastRefreshedAt
                ? `Updated ${formatTime(lastRefreshedAt)}`
                : "Auto-refresh every 15s"}
            </span>
            <button
              onClick={() => void fetchStats()}
              className="btn btn-ghost btn-sm"
              disabled={loading}
              title="Refresh now"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading || statsRefreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button onClick={() => void handleLogout()} className="btn btn-ghost btn-sm text-error gap-1">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {error && (
          <div className="alert alert-error shadow-none">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Users className="h-8 w-8 text-primary/70" strokeWidth={1.5} />, label: "Users", value: data?.stats.length ?? "—" },
            { icon: <Phone className="h-8 w-8 text-info/70" strokeWidth={1.5} />, label: "Numbers Used", value: totalAssigned },
            { icon: <MessageSquare className="h-8 w-8 text-success/70" strokeWidth={1.5} />, label: "SMS Received", value: totalSms },
            { icon: <XCircle className="h-8 w-8 text-warning/70" strokeWidth={1.5} />, label: "Released (no SMS)", value: totalReleased },
          ].map((c) => (
            <div key={c.label} className="card border border-base-300 bg-base-100 shadow-none">
              <div className="card-body flex-row items-center gap-3 p-4">
                {c.icon}
                <div>
                  <p className="text-xs text-base-content/50">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Default Service & Country Lock */}
        <div className="card border border-base-300 bg-base-100 shadow-none">
          <div className="card-body p-0">
            <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
              <div className="flex items-center gap-2">
                {currentLock ? (
                  <Lock className="h-4 w-4 text-primary" />
                ) : (
                  <Unlock className="h-4 w-4 text-base-content/40" />
                )}
                <h2 className="font-semibold">Default Service &amp; Country</h2>
                {currentLock && (
                  <span className="badge badge-primary badge-sm">Active</span>
                )}
              </div>
              <div className="flex gap-2">
                {currentLock && (
                  <button
                    onClick={() => void handleClearLock()}
                    className="btn btn-ghost btn-xs text-error gap-1"
                    disabled={lockSaving}
                  >
                    <Unlock className="h-3 w-3" /> Clear lock
                  </button>
                )}
                <button
                  onClick={() => {
                    if (showLockForm) {
                      setShowLockForm(false);
                      setLockError(null);
                    } else {
                      openLockForm();
                    }
                  }}
                  className="btn btn-primary btn-xs gap-1"
                >
                  <Lock className="h-3 w-3" />
                  {currentLock ? "Change" : "Set lock"}
                </button>
              </div>
            </div>

            {/* Current lock display */}
            <div className="px-5 py-4">
              {currentLock ? (
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div>
                    <span className="text-xs text-base-content/50">Service</span>
                    <p className="font-medium">{currentLock.name} <span className="text-base-content/40">· ID {currentLock.pid}</span></p>
                  </div>
                  <div>
                    <span className="text-xs text-base-content/50">Country</span>
                    <p className="font-medium uppercase">{currentLock.country}</p>
                  </div>
                  <p className="text-xs text-base-content/40">All users are locked to this service and country.</p>
                </div>
              ) : (
                <p className="text-sm text-base-content/40">No lock set — users can pick any service and country.</p>
              )}
            </div>

            {/* Lock form */}
            {showLockForm && (
              <div className="border-t border-base-300 bg-base-200/40 px-5 py-4 space-y-3">
                <p className="text-sm font-medium">Pick service &amp; country to lock for all users</p>

                {/* Service search + picker */}
                <div>
                  <label className="text-xs text-base-content/50 mb-1 block">Service</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
                    <input
                      type="search"
                      placeholder="Search by name or ID (e.g. Microsoft, 1234)…"
                      className="input input-bordered input-sm w-full pl-9"
                      value={lockServiceSearch}
                      disabled={lockServicesLoading}
                      onFocus={() => setLockServicePickerOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setLockServicePickerOpen(false), 150);
                      }}
                      onChange={(e) => {
                        setLockServiceSearch(e.target.value);
                        setLockServicePickerOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && filteredLockServices[0]) {
                          e.preventDefault();
                          selectLockService(filteredLockServices[0]);
                        }
                      }}
                    />
                  </div>
                  {lockSelectedPid && lockSelectedName && !lockServiceSearch && (
                    <p className="mt-1 text-xs text-base-content/70">
                      Selected: <span className="font-medium">{lockSelectedName}</span>
                      <span className="text-base-content/50"> · ID {lockSelectedPid}</span>
                    </p>
                  )}
                  {lockServicesLoading && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-base-content/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading services…
                    </p>
                  )}
                  {!lockServicesLoading && lockServices.length === 0 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs mt-2 w-full"
                      disabled={lockSyncingServices}
                      onClick={() => {
                        setLockSyncingServices(true);
                        void loadLockServices(true).finally(() => setLockSyncingServices(false));
                      }}
                    >
                      {lockSyncingServices ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Syncing…
                        </>
                      ) : (
                        "Sync services from Durian"
                      )}
                    </button>
                  )}
                  {showLockServicePicker && !lockServicesLoading && lockServices.length > 0 && (
                    <ul
                      className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-sm"
                      role="listbox"
                      aria-label="Service search results"
                    >
                      {!lockServiceQuery && (
                        <li className="border-b border-base-300 px-3 py-2 text-xs text-base-content/50">
                          Type to search {lockServices.length} services, or pick from the list
                        </li>
                      )}
                      {lockServiceQuery && filteredLockServices.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-base-content/50">
                          No services match &ldquo;{lockServiceSearch.trim()}&rdquo;
                        </li>
                      ) : (
                        lockPickerServices.map((s) => (
                          <li key={s.pid} role="option" aria-selected={lockSelectedPid === s.pid}>
                            <button
                              type="button"
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-base-200 ${
                                lockSelectedPid === s.pid ? "bg-primary/10" : ""
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectLockService(s)}
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="ml-2 text-xs text-base-content/50">
                                ID {s.pid}
                                {s.cost != null ? ` · ${s.cost} cr` : ""}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                      {lockServiceQuery && filteredLockServices.length > 100 && (
                        <li className="border-t border-base-300 px-3 py-2 text-xs text-base-content/50">
                          Showing 100 matches — refine your search
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Country search + select */}
                {lockSelectedPid && (
                  <div>
                    <label className="text-xs text-base-content/50 mb-1 block">Country</label>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
                      <input
                        type="search"
                        placeholder="Search country (e.g. us, USA, canada)…"
                        className="input input-bordered input-sm w-full pl-9"
                        value={lockCountrySearch}
                        disabled={lockCountriesLoading || lockCountries.length === 0}
                        onChange={(e) => setLockCountrySearch(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <select
                        className="select select-bordered select-sm w-full appearance-none pr-9"
                        value={
                          filteredLockCountries.some((c) => c.code === lockSelectedCountry)
                            ? lockSelectedCountry
                            : lockCountries.some((c) => c.code === lockSelectedCountry)
                              ? lockSelectedCountry
                              : ""
                        }
                        disabled={lockCountriesLoading || lockCountries.length === 0}
                        onChange={(e) => setLockSelectedCountry(e.target.value)}
                      >
                        {lockCountriesLoading && <option value="">Loading countries…</option>}
                        {!lockCountriesLoading && lockCountries.length === 0 && (
                          <option value="">No stock available</option>
                        )}
                        {!lockCountriesLoading &&
                          lockCountrySearch.trim() &&
                          filteredLockCountries.length === 0 && (
                            <option value="">No countries match your search</option>
                          )}
                        {filteredLockCountries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {countryDisplayLabel(c)} · {c.stock} in stock
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
                    </div>
                    {lockCountrySearch.trim() && filteredLockCountries.length > 0 && (
                      <p className="mt-1 text-xs text-base-content/50">
                        {filteredLockCountries.length} of {lockCountries.length} countries match
                      </p>
                    )}
                  </div>
                )}

                {lockError && <p className="text-xs text-error">{lockError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSaveLock()}
                    className="btn btn-primary btn-sm gap-1"
                    disabled={lockSaving || !lockSelectedPid || !lockSelectedCountry}
                  >
                    {lockSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Apply lock
                  </button>
                  <button onClick={() => { setShowLockForm(false); setLockError(null); }} className="btn btn-ghost btn-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily user report */}
        <div className="card border border-base-300 bg-base-100 shadow-none">
          <div className="card-body p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-4">
              <div>
                <h2 className="font-semibold">Daily report</h2>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Per worker, per day (UTC). Auto-refreshes every 15s.
                  {lastRefreshedAt ? ` Last update: ${formatTime(lastRefreshedAt)}.` : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-base-content/60">Range</span>
                <select
                  className="select select-bordered select-sm"
                  value={reportDays}
                  disabled={loading}
                  onChange={(e) => setReportDays(Number(e.target.value))}
                >
                  {REPORT_DAY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Username</th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-success" />SMS Received</span></th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><XCircle className="h-3.5 w-3.5 text-warning" />Released (no SMS)</span></th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><Phone className="h-3.5 w-3.5 text-info" />Total Numbers</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.dailyStats.map((row) => (
                    <tr key={`${row.date}-${row.userId}`}>
                      <td className="whitespace-nowrap text-sm text-base-content/80">
                        <span className="font-medium text-base-content">{formatReportDate(row.date)}</span>
                        <span className="ml-1.5 text-xs text-base-content/40">{row.date}</span>
                      </td>
                      <td className="font-medium">{row.username}</td>
                      <td className="text-center"><span className={`badge badge-sm ${row.smsReceived > 0 ? "badge-success" : "badge-ghost"}`}>{row.smsReceived}</span></td>
                      <td className="text-center"><span className={`badge badge-sm ${row.numbersReleased > 0 ? "badge-warning" : "badge-ghost"}`}>{row.numbersReleased}</span></td>
                      <td className="text-center"><span className="badge badge-sm badge-info">{row.totalAssigned}</span></td>
                    </tr>
                  ))}
                  {!loading && (data?.dailyStats.length ?? 0) === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-base-content/40">No activity in this period</td></tr>
                  )}
                  {loading && <tr><td colSpan={5} className="py-8 text-center text-base-content/40">Loading…</td></tr>}
                </tbody>
                {!loading && (data?.dailyStats.length ?? 0) > 0 && (
                  <tfoot>
                    <tr className="font-semibold border-t-2 border-base-300">
                      <td colSpan={2}>Period total</td>
                      <td className="text-center">
                        <span className="badge badge-sm badge-success">
                          {data!.dailyStats.reduce((s, r) => s + r.smsReceived, 0)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-sm badge-warning">
                          {data!.dailyStats.reduce((s, r) => s + r.numbersReleased, 0)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-sm badge-info">
                          {data!.dailyStats.reduce((s, r) => s + r.totalAssigned, 0)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="card border border-base-300 bg-base-100 shadow-none">
          <div className="card-body p-0">
            <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-base-content/50" />
                <h2 className="font-semibold">User Management</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPasswords((v) => !v)} className="btn btn-ghost btn-xs gap-1">
                  {showPasswords ? <><EyeOff className="h-3.5 w-3.5" />Hide</> : <><Eye className="h-3.5 w-3.5" />Show passwords</>}
                </button>
                <button
                  onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
                  className="btn btn-primary btn-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add user
                </button>
              </div>
            </div>

            {/* Add user form */}
            {showAddForm && (
              <form onSubmit={(e) => void handleAdd(e)} className="border-b border-base-300 bg-base-200/50 px-5 py-4">
                <p className="mb-3 text-sm font-medium">New user</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="form-control">
                    <label className="label py-0 pb-1"><span className="label-text text-xs">Username</span></label>
                    <input
                      ref={addUsernameRef}
                      type="text"
                      className="input input-bordered input-sm w-40"
                      placeholder="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-0 pb-1"><span className="label-text text-xs">Password</span></label>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-40"
                      placeholder="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-0 pb-1"><span className="label-text text-xs">Role</span></label>
                    <select
                      className="select select-bordered select-sm"
                      value={newUser.role}
                      onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                    {adding ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Add"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddForm(false); setAddError(null); }}>
                    Cancel
                  </button>
                </div>
                {addError && <p className="mt-2 text-xs text-error">{addError}</p>}
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Password</th>
                    <th>Role</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users.map((u) => (
                    <tr key={u.id}>
                      {editingId === u.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              className="input input-bordered input-xs w-32"
                              value={editState.username}
                              onChange={(e) => setEditState((p) => ({ ...p, username: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input input-bordered input-xs w-36"
                              value={editState.password}
                              onChange={(e) => setEditState((p) => ({ ...p, password: e.target.value }))}
                            />
                          </td>
                          <td>
                            <select
                              className="select select-bordered select-xs"
                              value={editState.role}
                              onChange={(e) => setEditState((p) => ({ ...p, role: e.target.value }))}
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {editError && <span className="mr-2 text-xs text-error">{editError}</span>}
                              <button
                                onClick={() => void saveEdit()}
                                className="btn btn-success btn-xs gap-1"
                                disabled={savingId === u.id}
                              >
                                {savingId === u.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Save
                              </button>
                              <button onClick={cancelEdit} className="btn btn-ghost btn-xs">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-mono">{u.username}</td>
                          <td className="font-mono">{showPasswords ? u.password : "••••••••"}</td>
                          <td>
                            <span className={`badge badge-xs ${u.role === "admin" ? "badge-primary" : "badge-ghost"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEdit(u)}
                                className="btn btn-ghost btn-xs gap-1"
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              {confirmDeleteId === u.id ? (
                                <>
                                  <span className="text-xs text-error">Sure?</span>
                                  <button
                                    onClick={() => void handleDelete(u.id)}
                                    className="btn btn-error btn-xs"
                                    disabled={deletingId === u.id}
                                  >
                                    {deletingId === u.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Yes"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-xs">No</button>
                                </>
                              ) : (
                                <button
                                  onClick={() => void handleDelete(u.id)}
                                  className="btn btn-ghost btn-xs text-error"
                                  title="Delete"
                                  disabled={deletingId === u.id}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!loading && data?.users.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-base-content/40">No users</td></tr>
                  )}
                  {loading && <tr><td colSpan={4} className="py-6 text-center text-base-content/40">Loading…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card border border-base-300 bg-base-100 shadow-none">
          <div className="card-body p-0">
            <div className="flex items-center gap-2 border-b border-base-300 px-5 py-4">
              <Activity className="h-4 w-4 text-base-content/50" />
              <h2 className="font-semibold">Recent Activity</h2>
              <span className="text-xs text-base-content/40">(last 100)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Phone</th>
                    <th>Country</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-base-content/50">{formatTime(e.assignedAt)}</td>
                      <td className="font-medium">{e.username}</td>
                      <td className="font-mono text-xs">{e.phoneNumber}</td>
                      <td className="text-xs uppercase">{e.country}</td>
                      <td>
                        {e.receivedSms ? (
                          <span className="badge badge-xs badge-success">SMS received</span>
                        ) : e.released ? (
                          <span className="badge badge-xs badge-warning">Released</span>
                        ) : (
                          <span className="badge badge-xs badge-ghost">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && data?.recent.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-base-content/40">No activity yet</td></tr>
                  )}
                  {loading && <tr><td colSpan={5} className="py-8 text-center text-base-content/40">Loading…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
