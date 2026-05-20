"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { readApiJson } from "@/lib/client-fetch-json";

export default function PanelRefreshPage() {
  const [captchaKey, setCaptchaKey] = useState(() => String(Date.now()));
  const [captcha, setCaptcha] = useState("");
  const [panelPassword, setPanelPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const newCaptcha = useCallback(() => {
    setCaptchaKey(String(Date.now()));
    setCaptcha("");
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captcha: captcha.trim(),
          ...(panelPassword.trim()
            ? { password: panelPassword.trim() }
            : {}),
        }),
      });
      const body = (await readApiJson(res)) as {
        error?: string;
        ok?: boolean;
        count?: number;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(body.error ?? "Panel login failed");
      }

      setSuccess(
        body.count != null
          ? `Linked — ${body.count} services available. You can go back and tap Sync if needed.`
          : (body.message ?? "Panel linked."),
      );
      setCaptcha("");
      newCaptcha();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Panel login failed");
      setCaptchaKey(String(Date.now()));
      setCaptcha("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <ThemeToggle className="absolute right-0 top-0" />
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <KeyRound className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel login</h1>
        <p className="mt-2 text-sm text-base-content/60">
          Refresh your DurianRCS web session from any device — no PC or terminal
          required. Use the same account as{" "}
          <code className="rounded bg-base-200 px-1">DURIAN_USERNAME</code> on
          the server.
        </p>
      </header>

      <section className="card border border-base-300/80 bg-base-100 shadow-sm">
        <form className="card-body gap-4 p-6" onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-control">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-text font-medium">Captcha</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 rounded-lg"
                onClick={() => newCaptcha()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                New image
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-base-300 bg-base-200/50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={captchaKey}
                src={`/api/panel/captcha?k=${encodeURIComponent(captchaKey)}`}
                alt="Captcha"
                className="mx-auto max-h-24 w-auto object-contain"
              />
            </div>
            <label className="label py-1" htmlFor="captcha">
              <span className="label-text-alt text-base-content/50">
                Load the image before typing — it sets a short-lived session on
                this browser.
              </span>
            </label>
            <input
              id="captcha"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="input input-bordered mt-1 w-full rounded-xl"
              placeholder="Digits from the image"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label py-0 pb-2" htmlFor="panel-pw">
              <span className="label-text font-medium">
                Durian web password{" "}
                <span className="font-normal text-base-content/50">
                  (optional)
                </span>
              </span>
            </label>
            <input
              id="panel-pw"
              type="password"
              autoComplete="off"
              className="input input-bordered w-full rounded-xl"
              placeholder="Only if DURIAN_WEB_PASSWORD is not set on the server"
              value={panelPassword}
              onChange={(e) => setPanelPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert alert-error rounded-xl py-3 text-sm shadow-none">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success rounded-xl py-3 text-sm shadow-none">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary h-11 w-full rounded-xl font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Linking…
              </>
            ) : (
              "Link Durian panel"
            )}
          </button>
        </form>
      </section>

      <p className="mt-4 text-center text-xs text-base-content/50">
        On Render, set{" "}
        <code className="rounded bg-base-200 px-1">DURIAN_USE_DISK_PANEL_COOKIE=1</code>{" "}
        so this session is preferred over an old{" "}
        <code className="rounded bg-base-200 px-1">DURIAN_SESSION_COOKIE</code> in
        env. Ephemeral disk resets on redeploy — run this page again after a
        deploy if sync breaks.
      </p>

      <div className="mt-6 text-center">
        <Link href="/" className="link link-primary text-sm">
          ← Back to orders
        </Link>
      </div>
    </div>
  );
}
