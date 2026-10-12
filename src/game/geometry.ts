// Cake geometry. Positions are in % of the cake box; the box is 1 wide by 1.05 tall,
// so SVG drawing coordinates (viewBox 0 0 100 105) are y * VB.
import type { PickRec, Placement, Slot } from './types';
import { mulberry, rnd, shuffle } from './util';

/** Center x, top radii, top center y, bottom center y of the cake drum. */
export const GX = 50,
  GRX = 34,
  GT = 56,
  GRY = 9,
  GB = 80,
  VB = 1.05;

export const inTop = (x: number, y: number) => ((x - GX) / GRX) ** 2 + ((y - GT) / GRY) ** 2 <= 1;
export const inCake = (x: number, y: number) =>
  inTop(x, y) || (Math.abs(x - GX) <= GRX && y >= GT && y <= GB + GRY * Math.sqrt(Math.max(0, 1 - ((x - GX) / GRX) ** 2)));
/** Where a pick's stick may stand: slightly inside the top ellipse. */
export const onTopOk = (x: number, y: number) => Math.hypot((x - GX) / (GRX * 0.9), (y - GT) / (GRY * 0.85)) <= 1;

/** Card width (% of cake width) for n picks. */
export const cardWFor = (n: number) => (n <= 4 ? 20 : n <= 6 ? 16 : n <= 8 ? 15 : 13);

/** Scale actually drawn: big cards near the back get shrunk so they never poke out of the stage. */
export const effScale = (p: Placement, n: number) => {
  const bw = cardWFor(n),
    st = p.stick || 11;
  return Math.max(0.5, Math.min(p.scale || 1, (p.y + 13) / (st + bw / VB)));
};

type Box = [number, number, number, number];

/** Bounding boxes of a pick's card (with name tag) and stick, after rotation. */
export const pickBox = (p: PickRec, n: number) => {
  const bw = cardWFor(n),
    st = p.stick || 11,
    sc = effScale(p, n),
    w = bw * sc,
    S = st * sc,
    tag = !!(p.img && p.label),
    tb = tag && p.labelPos !== 'above' ? 5 : 0,
    ta = tag && p.labelPos === 'above' ? 5 : 0,
    hw = (tag ? w * 1.3 : w) / 2,
    rr = ((p.rot || 0) * Math.PI) / 180,
    c = Math.cos(rr),
    s = Math.sin(rr);
  const aabb = (pts: [number, number][]): Box => {
    const X = pts.map(([u, v]) => p.x + u * c - v * VB * s),
      Y = pts.map(([u, v]) => p.y + (u * s + v * VB * c) / VB);
    return [Math.min(...X), Math.min(...Y), Math.max(...X), Math.max(...Y)];
  };
  const t0 = -(S + tb + w / VB + ta),
    b0 = -S + 1.9;
  return {
    card: aabb([
      [-hw, t0],
      [hw, t0],
      [hw, b0],
      [-hw, b0],
    ]),
    stick: aabb([
      [-1, -S],
      [1, -S],
      [1, 0],
      [-1, 0],
    ]),
  };
};

const boxHit = (a: Box, b: Box, m: number) => a[0] < b[2] + m && b[0] < a[2] + m && a[1] < b[3] + m && b[1] < a[3] + m;

export const pickClash = (a: PickRec, b: PickRec, n: number) => {
  const A = pickBox(a, n),
    B = pickBox(b, n);
  return boxHit(A.card, B.card, 0.8) || boxHit(A.card, B.stick, 0.2) || boxHit(A.stick, B.card, 0.2);
};

/**
 * The nearest spot where `p` doesn't overlap anyone: first the starting slots,
 * then a spiral search that may also straighten, shrink or re-stick the card.
 */
export const freeSpotFor = <T extends PickRec>(p: T, others: PickRec[], n: number, extra?: Slot[]): T => {
  if (onTopOk(p.x, p.y) && others.every((o) => !pickClash(p, o, n))) return p;
  for (const r0 of [p.rot || 0, 0])
    for (const e of extra || []) {
      const q = { ...p, rot: r0, x: e.x, y: e.y, stick: e.stick, scale: Math.min(p.scale || 1, e.scale || 1) };
      if (others.every((o) => !pickClash(q, o, n))) return q;
    }
  const bw = cardWFor(n),
    sticks = [p.stick || 11, ...[9.5, 9.5 + bw / VB + 6].filter((s) => Math.abs(s - (p.stick || 11)) > 0.5)],
    s0 = p.scale || 1;
  for (const rot of [p.rot || 0, 0])
    for (const scale of [s0, ...[1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4].filter((s) => s < s0)])
      for (const stick of sticks)
        for (let r = 0.75; r <= 45; r += 0.75)
          for (let a = 0; a < 24; a++) {
            const t = (a / 24) * 2 * Math.PI,
              q = { ...p, rot, scale, stick, x: p.x + r * Math.cos(t), y: p.y + r * 0.3 * Math.sin(t) };
            if (onTopOk(q.x, q.y) && others.every((o) => !pickClash(q, o, n))) return q;
          }
  return p;
};

/**
 * Starting spots for everyone's pick: a front row and a taller back row in the gaps,
 * shrinking the cards until nothing overlaps. Returns null if even the smallest size fails.
 */
export const layoutPicks = (players: { id: string }[]): Record<string, Slot> | null => {
  const n = players.length,
    bw = cardWFor(n),
    k = Math.max(1, Math.ceil((n + 1) / 2)),
    half = GRX * 0.9 * Math.sqrt(1 - ((58 - GT) / (GRY * 0.85)) ** 2) - 0.5;
  for (let s = 1; s >= 0.4; s -= 0.05) {
    const w = bw * s,
      sp = k > 1 ? Math.min((2 * half) / (k - 1), w + 4) : 0,
      fy = 58,
      fst = 9.5,
      ftop = pickBox({ x: 50, y: fy, stick: fst, scale: s }, n).card[1],
      by = 53,
      bst = Math.max(9.5, (by - ftop + 3.4) / s);
    const gaps = Array.from({ length: Math.max(0, k - 1) }, (_, i) => 50 + (i - (k - 2) / 2) * sp)
      .sort((p, q) => Math.abs(p - 50) - Math.abs(q - 50))
      .slice(0, n - k)
      .sort((p, q) => p - q);
    const slots: Slot[] = [
      ...Array.from({ length: k }, (_, i) => ({ x: 50 + (i - (k - 1) / 2) * sp, y: fy, stick: fst, scale: s, rot: 0 })),
      ...gaps.map((x) => ({ x, y: by, stick: bst, scale: s, rot: 0 })),
    ].slice(0, n);
    if (slots.length < n || !slots.every((p) => onTopOk(p.x, p.y))) continue;
    let ok = true;
    for (let i = 0; i < n && ok; i++)
      for (let j = i + 1; j < n; j++)
        if (pickClash(slots[i], slots[j], n)) {
          ok = false;
          break;
        }
    if (!ok) continue;
    const out: Record<string, Slot> = {};
    shuffle(players).forEach((p, i) => (out[p.id] = slots[i]));
    const ids = Object.keys(out);
    for (const id of ids) {
      const q = { ...out[id], rot: rnd(-2.5, 2.5) };
      if (ids.every((o) => o === id || !pickClash(q, out[o], n))) out[id] = q;
    }
    return out;
  }
  return null;
};

/** Frosting drips around the top edge (same on every device). */
export const DRIPS = (() => {
  const r = mulberry(11),
    out: { x: number; w: number; L: number }[] = [];
  for (let x = GX - GRX + 5; x <= GX + GRX - 5; x += 3.6 + r() * 2.4) {
    if (r() < 0.2) continue;
    const w = 1.2 + r() * 0.9;
    out.push({ x: x + r() * 1.2, w, L: w + 1.2 + r() * 6 });
  }
  return out;
})();

const dripDepth = (x: number) => {
  let d = 1.6;
  for (const k of DRIPS) {
    const dx = Math.abs(x - k.x);
    if (dx < k.w) d = Math.max(d, 1.6 + k.L - k.w + Math.sqrt(k.w * k.w - dx * dx));
  }
  return d;
};

/** Precomputed SVG paths for the cake drawing. */
export const ART = (() => {
  const rx = GRX,
    ry = GRY * VB,
    T = GT * VB,
    B = GB * VB,
    L = GX - rx,
    R = GX + rx,
    f = (n: number) => n.toFixed(2);
  const arc = (sw: number, x: number, y: number) => ' A' + rx + ' ' + f(ry) + ' 0 0 ' + sw + ' ' + f(x) + ' ' + f(y);
  const side = 'M' + L + ' ' + f(T) + ' L' + L + ' ' + f(B) + arc(0, R, B) + ' L' + R + ' ' + f(T) + ' Z';
  const band = (o: number, t: number) => 'M' + L + ' ' + f(T + o) + arc(0, R, T + o) + ' L' + R + ' ' + f(T + o + t) + arc(1, L, T + o + t) + ' Z';
  let drip = 'M' + L + ' ' + f(T) + arc(1, R, T);
  for (let x = R; x >= L - 0.001; x -= 0.25) {
    const u = Math.min(1, Math.abs(x - GX) / rx);
    drip += ' L' + f(x) + ' ' + f(T + ry * Math.sqrt(1 - u * u) + dripDepth(x));
  }
  drip += ' Z';
  const dollops: [number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * Math.PI * 2;
    dollops.push([GX + (rx - 1.7) * Math.cos(t), T + (ry - 1.2) * Math.sin(t)]);
  }
  dollops.sort((p, q) => p[1] - q[1]);
  const beads: [number, number][] = [];
  for (let i = 0; i <= 26; i++) {
    const t = (i / 26) * Math.PI;
    beads.push([GX + rx * Math.cos(t), B + ry * Math.sin(t)]);
  }
  beads.sort((p, q) => p[1] - q[1]);
  return { rx, ry, T, B, side, bands: [band(7.5, 2.1), band(15.5, 2.1)], drip, dollops, beads };
})();
