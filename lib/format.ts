/** Strip to digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** E.164-style value for clipboard (API expects +prefix). */
export function phoneCopyValue(phone: string): string {
  const d = digitsOnly(phone);
  if (!d) return phone.trim();
  if (phone.trim().startsWith("+")) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

/**
 * Human-readable phone display.
 * US/CA: +1 (209) 200-3261 · 10-digit: (209) 200-3261
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
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
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
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatStock(stock: number): string {
  if (stock >= 10_000) return `${Math.round(stock / 1000)}k`;
  return stock.toLocaleString();
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
