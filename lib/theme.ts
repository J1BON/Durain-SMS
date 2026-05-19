export const THEME_STORAGE_KEY = "durain_theme";

export type ThemeMode = "light" | "dark";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function themeColorMeta(theme: ThemeMode): string {
  return theme === "dark" ? "#1c1c1c" : "#fafaf9";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", themeColorMeta(theme));
  }
}

export function readStoredTheme(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) return stored;

  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}
