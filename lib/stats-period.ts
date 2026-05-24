import { BD_TIME_ZONE, formatDateTimeBd } from "./format";

export type StatsPeriod = "1h" | "today" | "since_reset" | "all";

export function startOfTodayBangladeshMs(): number {
  const key = new Date().toLocaleDateString("en-CA", { timeZone: BD_TIME_ZONE });
  return new Date(`${key}T00:00:00+06:00`).getTime();
}

/** Lower bound for `assigned_at` filter, or undefined for all time. */
export function resolveStatsSince(
  period: StatsPeriod,
  statsResetAt: number | null,
): number | undefined {
  const now = Date.now();
  switch (period) {
    case "1h":
      return now - 60 * 60 * 1000;
    case "today":
      return startOfTodayBangladeshMs();
    case "since_reset":
      return statsResetAt != null ? statsResetAt : undefined;
    case "all":
      return undefined;
  }
}

export function periodStatusMessage(
  period: StatsPeriod,
  statsResetAt: number | null,
): string {
  switch (period) {
    case "1h":
      return "Showing numbers and SMS from the last hour";
    case "today":
      return "Showing numbers and SMS from today (Bangladesh time)";
    case "since_reset":
      if (statsResetAt != null) {
        return `Showing numbers and SMS since counter was reset at ${formatDateTimeBd(statsResetAt)}`;
      }
      return "Counter not reset yet — showing all activity. Use Reset Counter when you want a new period.";
    case "all":
      return "Showing all numbers and SMS (all time)";
  }
}

export function parseStatsPeriod(value: string | null): StatsPeriod {
  if (value === "1h" || value === "today" || value === "since_reset" || value === "all") {
    return value;
  }
  return "today";
}
