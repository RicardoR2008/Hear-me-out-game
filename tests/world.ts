// A simulated room for multiplayer tests: many GameControllers sharing one in-memory
// database, driven by a virtual clock so whole games run in milliseconds.
import { GameController, type GameEnv } from '../src/game/controller';
import { buildViewModel } from '../src/game/viewModel';
import { Core, memoryNet } from '../src/net/core';
import type { Net } from '../src/net/types';

/** Size of the pretend cake box in pixels (same as the original design tests). */
export const W = 500,
  H = 525;

interface Timer {
  id: number;
  at: number;
  fn: () => void;
}

export class World {
  now = 1791800000000;
  core = new Core();
  errors: string[] = [];
  private timers: Timer[] = [];
  private tid = 0;

  setT = (fn: () => void, ms: number) => {
    const id = ++this.tid;
    this.timers.push({ id, at: this.now + (ms || 0), fn });
    return id;
  };
  clrT = (id: number | null | undefined) => {
    this.timers = this.timers.filter((t) => t.id !== id);
  };
  async drain() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
  /** Advance the clock by `ms`, firing every timer due on the way. */
  async run(ms: number) {
    const end = this.now + ms;
    for (let g = 0; g < 400000; g++) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const t = this.timers[0];
      if (!t || t.at > end) break;
      this.timers.shift();
      this.now = t.at;
      try {
        t.fn();
      } catch (e) {
        this.errors.push(String((e as Error)?.stack || e).slice(0, 300));
      }
      await this.drain();
    }
    this.now = end;
    await this.drain();
  }
  /** Run until `fn` is true or `ms` passes. */
  async until(fn: () => boolean, ms: number, step = 100) {
    for (let t = 0; t < ms; t += step) {
      if (fn()) return true;
      await this.run(step);
    }
    return fn();
  }
}

export interface Client {
  c: GameController;
  net: Net;
  uid: string;
  store: Record<string, string>;
  /** What the screens show. */
  V: () => ReturnType<typeof buildViewModel>;
  /** The derived game view. */
  S: () => ReturnType<GameController['view']>;
  up: () => void;
}

export function client(w: World, uid: string, store: Record<string, string> = {}): Client {
  const net = memoryNet(w.core, { uid, defer: (f) => void w.setT(f, 0), now: () => w.now });
  const env: GameEnv = {
    createNet: () => Promise.resolve(net),
    storage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    },
    setTimeout: w.setT,
    clearTimeout: w.clrT,
    probeImage: (src, onError) => void w.setT(() => (/fail/.test(src) ? onError() : undefined), 1),
  };
  const c = new GameController(env);
  c.start();
  c.cakeEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }) };
  return { c, net, uid, store, V: () => buildViewModel(c), S: () => c.view(), up: () => c.onPointerUp() };
}

export const allSee = (cs: Client[], scr: string) => cs.every((k) => k.S().screen === scr);

/** n players: u0 creates the room, the rest join it. */
export async function setup(n: number) {
  const w = new World(),
    cs: Client[] = [];
  for (let i = 0; i < n; i++) cs.push(client(w, 'u' + i));
  await w.run(50);
  const h = cs[0];
  h.c.setState({ name: 'P0' });
  await h.c.create();
  await w.run(50);
  const code = h.c.code;
  for (let i = 1; i < n; i++) {
    const k = cs[i];
    k.c.setState({ name: 'P' + i, codeInput: code });
    await k.c.joinRoom();
    await w.run(30);
  }
  await w.run(400);
  return { w, cs, code };
}

/** Pick card outline in pixels, for overlap checks on the final cake. */
export function rectPoly(it: { left: string; top: string; w: string; stickPx: string; rot: string }) {
  const num = (s: string) => parseFloat(s);
  const x = (num(it.left) / 100) * W,
    y = (num(it.top) / 100) * H,
    wd = (num(it.w) / 100) * W,
    st = (num(it.stickPx) / 100) * H,
    r = (num(it.rot) * Math.PI) / 180;
  const c = Math.cos(r),
    s = Math.sin(r);
  return [
    [-wd / 2, -st - wd],
    [wd / 2, -st - wd],
    [wd / 2, -st + 10],
    [-wd / 2, -st + 10],
  ].map(([a, b]) => [x + a * c - b * s, y + a * s + b * c]);
}

export function polyOverlap(A: number[][], B: number[][]) {
  for (const P of [A, B])
    for (let i = 0; i < 4; i++) {
      const p1 = P[i],
        p2 = P[(i + 1) % 4],
        nx = p2[1] - p1[1],
        ny = p1[0] - p2[0];
      let a1 = 1e9,
        a2 = -1e9,
        b1 = 1e9,
        b2 = -1e9;
      for (const q of A) {
        const d = q[0] * nx + q[1] * ny;
        a1 = Math.min(a1, d);
        a2 = Math.max(a2, d);
      }
      for (const q of B) {
        const d = q[0] * nx + q[1] * ny;
        b1 = Math.min(b1, d);
        b2 = Math.max(b2, d);
      }
      if (a2 <= b1 + 1e-6 || b2 <= a1 + 1e-6) return false;
    }
  return true;
}

// ---- play-through helpers. Each pushes a message to `f` and returns false if the game got stuck.

export async function playTheme(w: World, cs: Client[], f: string[], tag: string) {
  const host = cs.find((k) => k.S().isHost)!;
  host.c.startGame();
  await w.run(100);
  if (!allSee(cs, 'theme')) {
    f.push(tag + ': not everyone on theme screen');
    return false;
  }
  cs.forEach((k, i) => {
    k.c.setState({ themeIn: 'Idea ' + (i % 3) });
    k.c.submitSug();
  });
  if (!(await w.until(() => cs.every((k) => k.S().themeStage === 'vote' || k.S().themeStage === 'result'), 8000))) {
    f.push(tag + ': vote never opened');
    return false;
  }
  for (const k of cs) {
    const o = k.c.themeOpts(k.S()).find((x) => !x.by.includes('me'));
    k.c.castThemeVote(o ? o.key : null);
  }
  if (!(await w.until(() => allSee(cs, 'decorate'), 10000))) {
    f.push(tag + ': decorate never started ' + JSON.stringify(cs.map((k) => [k.S().screen, k.S().themeStage])));
    return false;
  }
  return true;
}

export async function playDecorate(w: World, cs: Client[], f: string[], tag: string, skip?: Client[]) {
  cs.forEach((k, i) => {
    if (skip && skip.includes(k)) return;
    k.c.setState({ tool: 'cherry' });
    k.c.onCakeDown({ clientX: W * (0.4 + 0.02 * i), clientY: H * 0.56, preventDefault() {} });
  });
  await w.run(100);
  const host = cs.find((k) => k.S().isHost);
  if (host) host.c.setCake('sponge', 'chocolate');
  await w.run(100);
  cs.forEach((k) => {
    if (!skip || !skip.includes(k)) k.c.setDecoReady(true);
  });
  if (!(await w.until(() => cs.filter((k) => !skip || !skip.includes(k)).every((k) => k.S().screen === 'submit'), 10000))) {
    f.push(tag + ': picking never started');
    return false;
  }
  return true;
}

export async function playPick(w: World, cs: Client[], f: string[], tag: string) {
  for (const k of cs) {
    k.c.setImg('https://img.test/' + k.uid + '.png');
    k.c.updMine({ label: 'Pick of ' + k.uid, caption: 'line one\nline two' });
  }
  await w.run(400);
  for (const k of cs) k.c.lockIn();
  await w.run(300);
  if (!cs.every((k) => k.c.allLocked())) {
    f.push(tag + ': not all locked');
    return false;
  }
  for (const k of cs) k.c.setRevealOk(true);
  await w.run(50);
  if (!(await w.until(() => cs.every((k) => k.S().screen === 'reveal' && !k.S().curtain), 12000))) {
    f.push(tag + ': reveal never opened');
    return false;
  }
  return true;
}

export async function playReveal(w: World, cs: Client[], f: string[], tag: string) {
  let guard = 0;
  while (cs[0].S().screen === 'reveal' && guard++ < 200) {
    const pres = cs.find((k) => k.S().order[k.S().idx] === 'me'),
      any = cs[0];
    const tot = any.c.partsOf(any.S().order[any.S().idx]).length;
    if (pres) {
      if ((pres.S().part || 0) < tot) {
        pres.c.presentNext();
        await w.run(60);
        const other = cs.find((k) => k !== pres);
        if (other && (other.S().part || 0) >= 1) other.c.react('laugh');
        continue;
      }
      pres.c.nextReveal();
      await w.run(80);
      continue;
    }
    await w.run(500);
    const h = cs.find((k) => k.S().isHost);
    if (h && (h.S().part || 0) >= tot) {
      h.c.nextReveal();
      await w.run(80);
    }
  }
  if (!(await w.until(() => allSee(cs, 'vote'), 5000))) {
    f.push(tag + ': vote screen never came');
    return false;
  }
  return true;
}

export async function playVote(w: World, cs: Client[], f: string[], tag: string) {
  for (const k of cs) {
    const vc = k.V().vote.cards;
    if (!vc.length) {
      f.push(tag + ': no vote cards for ' + k.uid);
      continue;
    }
    vc[0].onBest();
    vc[vc.length - 1].onUnh();
    k.c.submitVotes();
  }
  if (!(await w.until(() => allSee(cs, 'results'), 5000))) {
    f.push(tag + ': results never came');
    return false;
  }
  return true;
}
