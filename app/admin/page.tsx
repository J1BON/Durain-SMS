"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface UserStats {
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
  const [lockSelectedPid, setLockSelectedPid] = useState<number | null>(null);
  const [lockSelectedName, setLockSelectedName] = useState("");
  const [lockSelectedCountry, setLockSelectedCountry] = useState("");
  const [lockCountriesLoading, setLockCountriesLoading] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showLockForm, setShowLockForm] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        if (res.status === 403) { router.replace("/"); return; }
        throw new Error("Failed to load stats");
      }
      setData((await res.json()) as StatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  // Load current lock + services on mount
  useEffect(() => {
    void (async () => {
      try {
        const [settRes, svcRes] = await Promise.all([
          fetch("/api/admin/settings"),
          fetch("/api/services"),
        ]);
        const settJson = (await settRes.json()) as { lock: LockedSetting | null };
        const svcJson = (await svcRes.json()) as { services?: ServiceItem[] };
        setCurrentLock(settJson.lock ?? null);
        setLockServices(svcJson.services ?? []);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  // Load countries when a service is selected in the lock form
  useEffect(() => {
    if (!lockSelectedPid) { setLockCountries([]); setLockSelectedCountry(""); return; }
    setLockCountriesLoading(true);
    fetch(`/api/countries?pid=${lockSelectedPid}`)
      .then((r) => r.json())
      .then((d: { countries?: CountryItem[] }) => {
        setLockCountries(d.countries ?? []);
        setLockSelectedCountry(d.countries?.[0]?.code ?? "");
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

  const filteredLockServices = lockServiceSearch.trim()
    ? lockServices.filter(
        (s) =>
          s.name.toLowerCase().includes(lockServiceSearch.toLowerCase()) ||
          String(s.pid).includes(lockServiceSearch),
      ).slice(0, 60)
    : lockServices.slice(0, 60);

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
      await fetchStats();
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
      await fetchStats();
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
      await fetchStats();
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
            <button onClick={() => void fetchStats()} className="btn btn-ghost btn-sm" disabled={loading} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
                  onClick={() => { setShowLockForm((v) => !v); setLockError(null); }}
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

                {/* Service search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
                  <input
                    type="search"
                    placeholder="Search service by name or ID…"
                    className="input input-bordered input-sm w-full pl-9"
                    value={lockServiceSearch}
                    onChange={(e) => setLockServiceSearch(e.target.value)}
                  />
                </div>
                <select
                  className="select select-bordered select-sm w-full"
                  value={lockSelectedPid ?? ""}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const svc = lockServices.find((s) => s.pid === pid);
                    setLockSelectedPid(pid || null);
                    setLockSelectedName(svc?.name ?? "");
                  }}
                >
                  <option value="">— Select service —</option>
                  {filteredLockServices.map((s) => (
                    <option key={s.pid} value={s.pid}>
                      {s.name} · {s.pid}{s.cost != null ? ` · ${s.cost} cr` : ""}
                    </option>
                  ))}
                </select>

                {/* Country select */}
                {lockSelectedPid && (
                  <select
                    className="select select-bordered select-sm w-full"
                    value={lockSelectedCountry}
                    disabled={lockCountriesLoading || lockCountries.length === 0}
                    onChange={(e) => setLockSelectedCountry(e.target.value)}
                  >
                    {lockCountriesLoading && <option value="">Loading countries…</option>}
                    {!lockCountriesLoading && lockCountries.length === 0 && <option value="">No stock available</option>}
                    {lockCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code.toUpperCase()} · {c.stock} in stock
                      </option>
                    ))}
                  </select>
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

        {/* User Statistics */}
        <div className="card border border-base-300 bg-base-100 shadow-none">
          <div className="card-body p-0">
            <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
              <h2 className="font-semibold">User Statistics</h2>
              <span className="text-xs text-base-content/50">Only numbers that received SMS are counted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-success" />SMS Received</span></th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><XCircle className="h-3.5 w-3.5 text-warning" />Released (no SMS)</span></th>
                    <th className="text-center"><span className="flex items-center justify-center gap-1"><Phone className="h-3.5 w-3.5 text-info" />Total Numbers</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.stats.map((u) => (
                    <tr key={u.userId}>
                      <td className="font-medium">{u.username}</td>
                      <td className="text-center"><span className={`badge badge-sm ${u.smsReceived > 0 ? "badge-success" : "badge-ghost"}`}>{u.smsReceived}</span></td>
                      <td className="text-center"><span className={`badge badge-sm ${u.numbersReleased > 0 ? "badge-warning" : "badge-ghost"}`}>{u.numbersReleased}</span></td>
                      <td className="text-center"><span className="badge badge-sm badge-info">{u.totalAssigned}</span></td>
                    </tr>
                  ))}
                  {!loading && data?.stats.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-base-content/40">No activity yet</td></tr>
                  )}
                  {loading && <tr><td colSpan={4} className="py-8 text-center text-base-content/40">Loading…</td></tr>}
                </tbody>
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
