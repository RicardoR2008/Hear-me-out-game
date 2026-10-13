import type { Net, NetMode, TxResult, Unsubscribe } from './types';

type Tree = Record<string, unknown>;
export interface Op {
  path: string;
  val: unknown;
}

/** Deep copy that drops `undefined` (the database can't store it). */
export const clean = <T>(v: T): T => (v === undefined ? null : JSON.parse(JSON.stringify(v))) as T;

const parts = (p: string) => String(p || '').split('/').filter(Boolean);
const isObj = (n: unknown): n is Tree => n != null && typeof n === 'object';
const isEmpty = (o: unknown) => o == null || (isObj(o) && !Object.keys(o).length);

const getAt = (root: unknown, ps: string[]): unknown => {
  let n = root;
  for (const k of ps) {
    if (!isObj(n)) return null;
    n = n[k];
  }
  return n === undefined ? null : n;
};

function setAt(root: Tree, ps: string[], val: unknown): Tree {
  if (!ps.length) return isEmpty(val) ? {} : (clean(val) as Tree);
  let n = root;
  for (let i = 0; i < ps.length - 1; i++) {
    if (!isObj(n[ps[i]])) n[ps[i]] = {};
    n = n[ps[i]] as Tree;
  }
  const k = ps[ps.length - 1];
  if (val == null) delete n[k];
  else n[k] = clean(val);
  // Like Firebase, parents that end up empty disappear.
  for (let i = ps.length - 1; i > 0; i--) {
    if (!isEmpty(getAt(root, ps.slice(0, i)))) break;
    const gp = i > 1 ? getAt(root, ps.slice(0, i - 1)) : root;
    if (isObj(gp)) delete gp[ps[i - 1]];
  }
  return root;
}

const related = (a: string, b: string) => {
  const A = parts(a).join('/'),
    B = parts(b).join('/');
  return !A || !B || A === B || A.startsWith(B + '/') || B.startsWith(A + '/');
};

// Time-ordered ids in the same format as Firebase push keys.
const PUSH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPush = 0;
let lastRand: number[] = [];
export function pushId(now: number): string {
  let t = now,
    id = '';
  const dup = t === lastPush;
  lastPush = t;
  for (let i = 7; i >= 0; i--) {
    id = PUSH.charAt(t % 64) + id;
    t = Math.floor(t / 64);
  }
  if (!dup) lastRand = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64));
  else {
    let i = 11;
    while (i >= 0 && lastRand[i] === 63) {
      lastRand[i] = 0;
      i--;
    }
    if (i >= 0) lastRand[i]++;
  }
  return id + lastRand.map((n) => PUSH.charAt(n)).join('');
}

interface Sub {
  path: string;
  fire: () => void;
}

/** An in-memory database tree that notifies subscribers of changes. */
export class Core {
  root: Tree;
  private subs = new Set<Sub>();
  constructor(root?: Tree) {
    this.root = root || {};
  }
  get(p: string): unknown {
    return clean(getAt(this.root, parts(p)));
  }
  apply(ops: Op[]): void {
    for (const o of ops) this.root = setAt(this.root, parts(o.path), o.val);
    for (const s of [...this.subs]) if (ops.some((o) => related(o.path, s.path))) s.fire();
  }
  sub(path: string, fire: () => void): Unsubscribe {
    const s = { path, fire };
    this.subs.add(s);
    return () => this.subs.delete(s);
  }
}

export interface MemoryOptions {
  uid?: string;
  mode?: NetMode;
  now?: () => number;
  /** How change notifications are scheduled. Defaults to the next macrotask, like a network. */
  defer?: (fn: () => void) => void;
}

/** A client of a shared Core: used by practice mode and by the tests. */
export function memoryNet(core: Core, opt: MemoryOptions = {}): Net {
  const defer = opt.defer || ((f: () => void) => void setTimeout(f, 0));
  const now = opt.now || (() => Date.now());
  const uid = opt.uid || 'u' + Math.random().toString(36).slice(2, 12);
  let pres: string | null = null;
  let connected = true;
  const connSubs = new Set<(c: boolean) => void>();
  const api: Net = {
    mode: opt.mode || 'memory',
    uid,
    ready: () => Promise.resolve(uid),
    now,
    watch(path, cb) {
      let alive = true,
        pend = false;
      const fire = () => {
        if (pend) return;
        pend = true;
        defer(() => {
          pend = false;
          if (alive) cb(core.get(path));
        });
      };
      const un = core.sub(path, fire);
      fire();
      return () => {
        alive = false;
        un();
      };
    },
    get: (p) => Promise.resolve(core.get(p)),
    set(p, v) {
      core.apply([{ path: p, val: clean(v) }]);
      return Promise.resolve();
    },
    update(p, obj) {
      core.apply(Object.entries(obj || {}).map(([k, v]) => ({ path: p + '/' + k, val: clean(v) })));
      return Promise.resolve();
    },
    remove: (p) => api.set(p, null),
    push(p, v) {
      const k = pushId(now());
      void api.set(p + '/' + k, v);
      return k;
    },
    tx(p, fn): Promise<TxResult> {
      const nv = fn(core.get(p));
      if (nv === undefined) return Promise.resolve({ committed: false, val: core.get(p) });
      core.apply([{ path: p, val: clean(nv) }]);
      return Promise.resolve({ committed: true, val: core.get(p) });
    },
    presence(p) {
      pres = p;
      core.apply([{ path: p, val: true }]);
      return () => {
        if (pres === p) pres = null;
      };
    },
    onConnected(cb) {
      connSubs.add(cb);
      defer(() => {
        if (connSubs.has(cb)) cb(connected);
      });
      return () => {
        connSubs.delete(cb);
      };
    },
    setConnected(on) {
      connected = on;
      for (const cb of [...connSubs]) cb(on);
    },
    disconnect() {
      if (pres) core.apply([{ path: pres, val: false }]);
    },
    pruneRooms(maxAge) {
      const rooms = (core.get('rooms') || {}) as Record<string, { meta?: { createdAt?: number } } | null>;
      const cut = now() - maxAge,
        ops: Op[] = [];
      for (const [k, r] of Object.entries(rooms))
        if (r && r.meta && (r.meta.createdAt || 0) < cut) ops.push({ path: 'rooms/' + k, val: null });
      if (ops.length) core.apply(ops);
      return Promise.resolve();
    },
  };
  return api;
}
