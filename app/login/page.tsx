"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, MessageSquare, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? "Login failed");
      }

      const from = searchParams.get("from") || "/";
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card border border-base-300/80 bg-base-100 shadow-sm">
      <form className="card-body gap-4 p-6" onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-control">
          <label className="label py-0 pb-2" htmlFor="username">
            <span className="label-text font-medium">Username</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="input input-bordered w-full rounded-xl pl-10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label py-0 pb-2" htmlFor="password">
            <span className="label-text font-medium">Password</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input input-bordered w-full rounded-xl pl-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-error rounded-xl py-3 text-sm shadow-none">
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary mt-2 h-12 w-full rounded-xl text-base font-medium"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        <p className="text-center text-xs text-base-content/45">
          Session stays signed in until you log out.
        </p>
      </form>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <ThemeToggle className="absolute right-0 top-0" />
      <header className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <MessageSquare className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Durain SMS</h1>
        <p className="mt-1 text-sm text-base-content/60">Sign in to continue</p>
      </header>

      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
