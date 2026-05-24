/** Strip to digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Bangladesh locale and timezone (BST, UTC+6). */
export const BD_LOCALE = "en-BD";
export const BD_TIME_ZONE = "Asia/Dhaka";

const bdDateTimeFmt = new Intl.DateTimeFormat(BD_LOCALE, {
  timeZone: BD_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const bdDateLongFmt = new Intl.DateTimeFormat(BD_LOCALE, {
  timeZone: BD_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Calendar day key YYYY-MM-DD in Bangladesh time (for daily stats buckets). */
export function dateKeyInBangladesh(assignedAt: number): string {
  return new Date(assignedAt).toLocaleDateString("en-CA", {
    timeZone: BD_TIME_ZONE,
  });
}

/** Date + time, e.g. 24/05/2026, 11:27:26 pm */
export function formatDateTimeBd(ts: number): string {
  return bdDateTimeFmt.format(new Date(ts));
}

/** Long date from YYYY-MM-DD key, e.g. Sat, 24 May 2026 */
export function formatDateKeyLongBd(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return bdDateLongFmt.format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

/** Short date from YYYY-MM-DD key, e.g. 24/05/2026 */
export function formatDateKeyShortBd(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/**
 * Canonical E.164-ish value for Durian ext_api query params (`pn`, etc.).
 * Accepts numbers the UI may show with spaces or parentheses.
 */
export function phoneForDurianExtApi(
  pn: string,
  countryCode?: string,
): string {
  const raw = pn.trim();
  const d = digitsOnly(raw);
  if (!d) return raw;
  const isUs =
    countryCode?.toLowerCase() === "us" ||
    countryCode?.toLowerCase() === "usa";
  if (raw.startsWith("+")) return `+${d}`;
  if (d.length === 10 && isUs) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1") && isUs) return `+${d}`;
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

/**
 * Phone string for clipboard — US/CA includes +1, e.g. +1 (337) 998-9135.
 */
export function phoneCopyValue(phone: string): string {
  const raw = phone.trim();
  const d = digitsOnly(raw);
  if (!d) return raw;

  if (d.length === 11 && d.startsWith("1")) {
    const n = d.slice(1);
    return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }

  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  return formatPhoneDisplay(raw);
}

/**
 * Human-readable phone display.
 * US/CA: +1 (209) 200-3261
 */
export function formatPhoneDisplay(phone: string): string {
  const raw = phone.trim();
  const d = digitsOnly(raw);
  if (!d) return raw;

  if (d.length === 11 && d.startsWith("1")) {
    const n = d.slice(1);
    return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }

  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  if (d.length === 12 && d.startsWith("44")) {
    const n = d.slice(2);
    return `+44 ${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  }

  if (d.length === 11 && d.startsWith("44")) {
    const n = d.slice(2);
    return `+44 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }

  if (raw.startsWith("+") && d.length > 10) {
    const national = d.slice(-10);
    const cc = d.slice(0, d.length - 10);
    if (cc === "1") {
      return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
    }
    return `+${cc} ${national.slice(0, 3)} ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  if (d.length > 6) {
    const grouped = d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
    return raw.startsWith("+") ? `+${grouped}` : grouped;
  }

  return raw;
}

/** Space-group verification codes: 882181 → 882 181 */
export function formatSmsCodeDisplay(code: string): string {
  const digits = digitsOnly(code) || code.trim();
  if (!digits) return code;

  if (digits.length === 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length === 5) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    const mid = Math.ceil(digits.length / 2);
    return `${digits.slice(0, mid)} ${digits.slice(mid)}`;
  }

  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

/** Raw digits only for copying codes. */
export function smsCodeCopyValue(code: string): string {
  const digits = digitsOnly(code);
  return digits || code.trim();
}

export function formatCredits(n: number): string {
  return n.toLocaleString(BD_LOCALE, { maximumFractionDigits: 0 });
}

export function formatStock(stock: number): string {
  if (stock >= 10_000) return `${Math.round(stock / 1000)}k`;
  return stock.toLocaleString(BD_LOCALE);
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
