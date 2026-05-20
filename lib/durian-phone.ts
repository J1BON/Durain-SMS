import { digitsOnly, phoneForDurianExtApi } from "./format";

/**
 * Durian getMsg often requires the same `pn` shape as getMobile returned.
 * Try several safe variants before giving up on a poll cycle.
 */
export function pnVariantsForDurianMsg(pn: string): string[] {
  const raw = pn.trim();
  if (!raw) return [];

  const out: string[] = [];
  const add = (v: string) => {
    const t = v.trim();
    if (t && !out.includes(t)) out.push(t);
  };

  add(raw);
  add(phoneForDurianExtApi(raw));

  const d = digitsOnly(raw);
  if (d) {
    add(d);
    if (d.length === 10) {
      add(`1${d}`);
      add(`+1${d}`);
    }
    if (d.length === 11 && d.startsWith("1")) {
      add(`+${d}`);
      add(d.slice(1));
    }
  }

  return out;
}
