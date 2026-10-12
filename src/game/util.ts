import type { ArrLike } from './types';

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const shuffle = <T>(a: readonly T[]): T[] => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Small seeded random number generator, so decorative randomness is the same on every device. */
export function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arrays come back from Firebase as objects when keys are sparse; this reads both. */
export const asArr = <T>(x: ArrLike<T> | null | undefined): T[] =>
  Array.isArray(x)
    ? x
    : x && typeof x === 'object'
      ? Object.keys(x)
          .sort((p, q) => +p - +q)
          .map((k) => x[k])
      : [];

export const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** "05 OCT 2026 · 0907 HRS" */
export const milStamp = (t: number) => {
  const d = new Date(t),
    p = (n: number) => String(n).padStart(2, '0');
  return p(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + p(d.getHours()) + p(d.getMinutes()) + ' HRS';
};

/** A defense split into its non-empty lines; each line is revealed separately. */
export const capLines = (c: string | null | undefined) =>
  String(c || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

export const cleanTheme = (t: unknown) =>
  String(t || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
/** Theme ideas that differ only in case or spacing count as the same idea. */
export const normTheme = (t: unknown) => cleanTheme(t).toLowerCase();

/** ["A", "B", "C"] → "A, B and C" */
export const listJoin = (a: string[]) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

/** A CSS url() value that survives quotes and backslashes in the address. */
export const cssUrl = (src: string) =>
  'url("' + String(src).replace(/[\n\r]/g, '').replace(/\\/g, '%5C').replace(/"/g, '%22') + '")';
