"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  readStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    const current = document.documentElement.getAttribute("data-theme");
    const resolved: ThemeMode =
      stored ??
      (current === "dark" || current === "light" ? current : "light");
    setTheme(resolved);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-square rounded-lg text-base-content/60 hover:text-base-content ${className}`}
      onClick={toggle}
      disabled={!mounted}
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      {mounted ? (
        theme === "light" ? (
          <Moon className="h-4 w-4" aria-hidden />
        ) : (
          <Sun className="h-4 w-4" aria-hidden />
        )
      ) : (
        <span className="inline-block h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
