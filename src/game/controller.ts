import type { Net, Unsubscribe } from '../net/types';
import {
  CHARS,
  COLORS,
  CONNECT_WAIT_MS,
  CUR,
  CURTAIN_TOTAL,
  FR,
  HOST_BEAT_MS,
  HOST_STALE_MS,
  INK,
  MAXP,
  MINP,
  NOUN,
  PENS,
  PL,
  REACTS,
  ROOM_CODE_LETTERS,
  ROOM_MAX_AGE_MS,
  SP,
  STRIPES,
  newCake,
} from './constants';
import { GRX, GRY, GT, GX, freeSpotFor, inCake, inTop, layoutPicks, pickClash } from './geometry';
import { shrinkImage } from './image';
import { buildKeepsake, downloadHtml } from './keepsake';
import type {
  Award,
  CakePart,
  CakeSpec,
  DayNight,
  Meta,
  Phase,
  PenKey,
  PickRec,
  PlayerRec,
  ReactKey,
  Room,
  Screen,
  Slot,
  ThemeMode,
  ThemeStage,
  ToolKey,
  ToppingType,
} from './types';
import { asArr, capLines, cleanTheme, errMsg, normCode, normTheme, pick, rnd, sameName, shuffle, signInTrouble } from './util';

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The cake box element (or a stand-in in tests). */
export interface CakeBox {
  getBoundingClientRect(): RectLike;
  parentElement?: HTMLElement | null;
}

/** Everything the controller needs from its surroundings, so tests can run it without a browser. */
export interface GameEnv {
  createNet(): Promise<Net>;
  storage: KeyValueStore | null;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number | null | undefined): void;
  /** Calls onError if the image at `src` can't be loaded. */
  probeImage(src: string, onError: () => void): void;
}

export interface Floater {
  id: number;
  k: ReactKey;
  by: string;
  pick: string;
  /** Start position: % across the panel and px up from its bottom. */
  x: number;
  b: number;
  dx: number;
  rot: number;
  rise: number;
  size: number;
}

export interface LocalState {
  theme: DayNight | null;
  screen: 'join' | 'room';
  name: string;
  codeInput: string;
  code: string;
  err: string;
  /** Status line on the join screen while a Create/Join waits for the connection. */
  joinNote: string;
  busy: boolean;
  uid: string | null;
  /** The connection dropped after having worked (shows "Connection lost" until it's back). */
  offline: boolean;
  /** A newer version of the game has been published since this page loaded. */
  updateReady: boolean;
  room: Room | null;
  netMode: string;
  netNote: string;
  tool: ToolKey;
  pen: PenKey;
  hint: string;
  linkVal: string;
  imgErr: boolean;
  /** The file dropped or chosen isn't a picture. */
  fileErr: boolean;
  dragOver: boolean;
  themeIn: string;
  votes: { best: string | null; unh: string | null };
  keepsake: '' | 'working' | 'done' | 'error';
  keepsakeName: string;
  floaters: Floater[];
  myPick: PickRec | null;
  tick: number;
}

// In a View, the current player's id is replaced by 'me'.
export interface ViewPlayer {
  id: string;
  uid: string;
  name: string;
  color: string;
  char: number;
  online: boolean;
  host: boolean;
}
export interface ViewTopping {
  id: string;
  type: ToppingType;
  x: number;
  y: number;
  by: string;
  rot: number;
  stripe: string;
  at: number;
}
export interface ViewStroke {
  id: string;
  by: string;
  color: string;
  pts: number[][];
  at: number;
}
export interface ViewLog {
  id: string;
  text: string;
  color: string;
  emoji: string;
}
export interface CurtainState {
  phase: 'close' | 'count' | 'ring' | 'open';
  /** Number on the clock. */
  n: number;
  /** ms since the curtain started. */
  t: number;
}
export interface ThemeResultView {
  text: string;
  by: string[];
  votes: number;
  tie: boolean;
  consensus: boolean;
}

export interface View extends Omit<LocalState, 'screen'> {
  screen: Screen;
  players: ViewPlayer[];
  picks: Record<string, PickRec>;
  ready: Record<string, boolean>;
  locked: boolean;
  order: string[];
  idx: number;
  part: number;
  reacts: Record<string, Partial<Record<ReactKey, number>>>;
  cake: CakeSpec;
  cakeBy: Partial<Record<CakePart, string>>;
  toppings: ViewTopping[];
  strokes: ViewStroke[];
  log: ViewLog[];
  decoReady: Record<string, boolean>;
  /** Who has said they're ready for the reveal (pick screen). */
  revealOk: Record<string, boolean>;
  themeSugs: Record<string, string>;
  themeVotes: Record<string, string | null>;
  themeMode: ThemeMode;
  themeAgreed: string;
  cakeTheme: string;
  themeStage: ThemeStage | null;
  themeResult: ThemeResultView | null;
  /** Seconds left before decorating starts (theme result). */
  themeGo: number | null;
  /** Seconds left before picking starts (everyone done decorating). */
  decoGo: number | null;
  curtain: CurtainState | null;
  results: { best: Award | null; unh: Award | null; bestTie: boolean; unhTie: boolean } | null;
  finishedAt: number | null;
  pickN: number;
  isHost: boolean;
  hostName: string;
  joined: boolean;
  hasVoted: boolean;
  slots: Slot[];
}

export interface ThemeOption {
  key: string;
  text: string;
  by: string[];
}

interface HostInfo {
  host: string | null;
  active: (PlayerRec & { uid: string })[];
  all: (PlayerRec & { uid: string })[];
}

const DEFAULT_PICK: PickRec = { x: 50, y: 58, stick: 11, scale: 1, flip: false, labelPos: 'below', rot: 0 };
const isKey = <T extends object>(m: T, k: unknown): k is keyof T => typeof k === 'string' && Object.prototype.hasOwnProperty.call(m, k);
const keyOf = <T extends object>(m: T, k: unknown, fallback: keyof T): keyof T => (isKey(m, k) ? k : fallback);

let floaterSeq = 0;

/**
 * All game logic for one player. Holds local state, mirrors the shared room,
 * and (when this player is host) moves the room through its phases.
 * Framework-agnostic: the UI subscribes and renders from `view()`.
 */
export class GameController {
  state: LocalState;
  net: Net | null = null;
  /** Code of the room I'm in ('' when on the join screen). */
  code = '';
  /** The element the cake is drawn in; pointer positions are measured against it. */
  cakeEl: CakeBox | null = null;

  drawing: { key: string; pts: number[][] } | null = null;
  dragging = false;
  resizing: { bx: number; by: number; s: number; d0: number } | null = null;
  rotating: { bx: number; by: number; r0: number; a0: number } | null = null;

  private readonly env: GameEnv;
  private listeners = new Set<() => void>();
  private version = 0;
  private started = false;
  private timers: number[] = [];
  private tickT: number | null = null;
  private syncT: number | null = null;
  private strokeT: number | null = null;
  private unwatch: Unsubscribe | null = null;
  private stopPresence: Unsubscribe | null = null;
  /** Things I added while decorating, newest last (for "Undo mine"). */
  private myHist: string[] = [];
  private seenEv = new Set<string>();
  /** My pick, updated synchronously while dragging (state.myPick mirrors it). */
  private mine: PickRec | null = null;
  private dragOff = { x: 0, y: 0 };
  private autoAt = 0;
  /** Set if signing in failed for good, so Create/Join can say why instead of "still connecting". */
  private signInError = '';
  /** Create/Join pressed before the connection was ready: it runs by itself once it is. */
  private pendingAct: 'create' | 'join' | null = null;
  private pendingT: number | null = null;
  private everConnected = false;
  /** When I last refreshed the host heartbeat. */
  private beatAt = 0;
  /** Room transitions with a transaction in flight, so each is tried once at a time. */
  private inflight = new Set<string>();
  /** Room code from an invite link (?room=ABCD). */
  private invite = '';

  constructor(env: GameEnv) {
    this.env = env;
    const saved = this.load('hmo-theme');
    this.state = {
      theme: saved === 'night' || saved === 'day' ? saved : null,
      screen: 'join',
      name: this.load('hmo-name') || '',
      codeInput: '',
      code: '',
      err: '',
      joinNote: '',
      busy: false,
      uid: null,
      offline: false,
      updateReady: false,
      room: null,
      netMode: '',
      netNote: '',
      tool: 'cherry',
      pen: 'white',
      hint: '',
      linkVal: '',
      imgErr: false,
      fileErr: false,
      dragOver: false,
      themeIn: '',
      votes: { best: null, unh: null },
      keepsake: '',
      keepsakeName: '',
      floaters: [],
      myPick: null,
      tick: 0,
    };
  }

  // ---- store plumbing -------------------------------------------------------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  setState(update: Partial<LocalState> | ((s: LocalState) => Partial<LocalState>)) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    this.forceUpdate();
  }
  forceUpdate() {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }

  private load(k: string) {
    try {
      return this.env.storage ? this.env.storage.getItem(k) : null;
    } catch {
      return null;
    }
  }
  private save(k: string, v: string | null) {
    try {
      if (!this.env.storage) return;
      if (v == null) this.env.storage.removeItem(k);
      else this.env.storage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  }

  private later(fn: () => void, ms: number) {
    const t = this.env.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      fn();
    }, ms);
    this.timers.push(t);
    return t;
  }
  private clearTimers() {
    this.timers.forEach((t) => this.env.clearTimeout(t));
    this.timers = [];
  }

  private get db(): Net {
    if (!this.net) throw new Error('Not connected yet.');
    return this.net;
  }

  now() {
    return this.net ? this.net.now() : Date.now();
  }
  rp(p?: string) {
    return 'rooms/' + this.code + (p ? '/' + p : '');
  }
  uidOf(id: string) {
    return id === 'me' ? (this.state.uid as string) : id;
  }

  // ---- lifecycle ------------------------------------------------------------

  start() {
    if (this.started) return;
    this.started = true;
    this.env
      .createNet()
      .then((net) => {
        this.net = net;
        this.setState({
          netMode: net.mode,
          netNote:
            net.mode === 'local'
              ? 'Practice mode: rooms only work between tabs in this browser.' +
                (net.fallbackReason ? ' Firebase error: ' + net.fallbackReason : ' Add your Firebase config to play online.')
              : '',
        });
        // "Connection lost" shows only after the connection has worked once (not while first connecting).
        net.onConnected((on) => {
          if (on) this.everConnected = true;
          const offline = !on && this.everConnected;
          if (offline !== this.state.offline) this.setState({ offline });
        });
        return net.ready().then((uid) => {
          this.setState({ uid });
          const act = this.pendingAct;
          this.clearPending();
          if (act) void (act === 'create' ? this.create() : this.joinRoom());
          else void this.tryRejoin();
          void net.pruneRooms(ROOM_MAX_AGE_MS);
        });
      })
      .catch((e) => {
        this.signInError = signInTrouble(e);
        this.clearPending();
        this.setState({ err: this.signInError });
      });
    const loop = () => {
      try {
        this.onTick();
      } catch (e) {
        console.error(e);
      }
      this.tickT = this.env.setTimeout(loop, this.isLive() ? 100 : 250);
    };
    this.tickT = this.env.setTimeout(loop, 250);
  }

  /** Create/Join was pressed before the connection was ready: say so and do it as soon as it is. */
  private waitForConnection(act: 'create' | 'join') {
    if (this.signInError) {
      this.setState({ err: this.signInError });
      return;
    }
    this.pendingAct = act;
    this.env.clearTimeout(this.pendingT);
    this.pendingT = this.env.setTimeout(() => {
      this.pendingT = null;
      if (!this.pendingAct) return;
      this.pendingAct = null;
      this.setState({ busy: false, joinNote: '', err: 'Still connecting. Check your internet, then try again.' });
    }, CONNECT_WAIT_MS);
    this.setState({ busy: true, err: '', joinNote: 'Still connecting… It will go through on its own.' });
  }
  private clearPending() {
    const was = !!this.pendingAct;
    this.pendingAct = null;
    this.env.clearTimeout(this.pendingT);
    this.pendingT = null;
    if (was) this.setState({ busy: false, joinNote: '' });
  }

  /** A room code from an invite link (?room=ABCD): fill it in, ready to join. Call before start(). */
  useInvite(raw: unknown) {
    const c = normCode(raw);
    if (c.length !== 4) return;
    this.invite = c;
    this.setState({ codeInput: c });
  }

  stop() {
    this.clearTimers();
    this.env.clearTimeout(this.tickT);
    this.env.clearTimeout(this.syncT);
    this.env.clearTimeout(this.strokeT);
    if (this.unwatch) this.unwatch();
    this.unwatch = null;
    this.started = false;
  }

  // ---- day / night ----------------------------------------------------------

  isNight() {
    return this.state.theme === 'night';
  }
  setTheme(t: DayNight) {
    this.setState({ theme: t });
    this.save('hmo-theme', t);
  }

  // ---- host & view ----------------------------------------------------------

  hostInfo(room: Room | null = this.state.room): HostInfo {
    const m = room?.meta || {};
    const all = Object.entries(room?.players || {})
      .map(([uid, p]) => ({ ...p, uid }))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || (a.uid < b.uid ? -1 : 1));
    const active = all.filter((p) => p.online !== false);
    const named = active.find((p) => p.uid === m.host);
    // Mid-game, a host whose screen has stopped answering hands over to the next player.
    const h = (named && this.hostQuiet(m) ? active.find((p) => p.uid !== m.host) : named) || named || active[0] || null;
    return { host: h ? h.uid : null, active, all };
  }
  /** The host's heartbeat has gone quiet during a game (phone locked, app switched, tab asleep). */
  private hostQuiet(m: Meta) {
    const ph = m.phase || 'lobby';
    return ph !== 'lobby' && ph !== 'results' && !!m.hb && this.now() - m.hb > HOST_STALE_MS;
  }
  amHost() {
    return !!this.state.uid && this.hostInfo().host === this.state.uid;
  }

  /** Everything the UI shows, derived from local state + the shared room. */
  view(): View {
    const st = this.state,
      R = st.room,
      my = st.uid;
    if (st.screen !== 'room' || !R || !R.meta)
      return {
        ...st,
        screen: st.screen === 'room' ? 'connecting' : 'join',
        players: [],
        picks: {},
        ready: {},
        locked: false,
        order: [],
        idx: 0,
        part: 0,
        reacts: {},
        cake: newCake(),
        cakeBy: {},
        toppings: [],
        strokes: [],
        log: [],
        decoReady: {},
        revealOk: {},
        themeSugs: {},
        themeVotes: {},
        themeMode: 'vote',
        themeAgreed: '',
        cakeTheme: '',
        themeStage: null,
        themeResult: null,
        themeGo: null,
        decoGo: null,
        curtain: null,
        results: null,
        finishedAt: null,
        pickN: 1,
        isHost: false,
        hostName: '',
        joined: false,
        hasVoted: false,
        slots: [],
      };
    const M = R.meta,
      L = (id: string) => (id === my ? 'me' : id),
      mk = <T,>(o: Record<string, T> | undefined) => Object.fromEntries(Object.entries(o || {}).map(([k, x]) => [L(k), x])) as Record<string, T>,
      now = this.now(),
      hi = this.hostInfo(R);
    const players: ViewPlayer[] = hi.all.map((p) => ({
      id: L(p.uid),
      uid: p.uid,
      name: p.name || '?',
      color: p.color || COLORS[0],
      char: p.char || 0,
      online: p.online !== false,
      host: p.uid === hi.host,
    }));
    let curtain: CurtainState | null = null;
    if (M.curtainAt) {
      const t = now - M.curtainAt,
        c1 = CUR.close,
        c2 = c1 + CUR.count,
        c3 = c2 + CUR.ring,
        secs = CUR.count / 1000;
      if (t < c1) curtain = { phase: 'close', n: secs, t };
      else if (t < c2) curtain = { phase: 'count', n: Math.max(1, secs - Math.floor((t - c1) / 1000)), t };
      else if (t < c3) curtain = { phase: 'ring', n: 0, t };
      else if (t < CURTAIN_TOTAL) curtain = { phase: 'open', n: 0, t };
    }
    let screen: Screen = M.phase || 'lobby';
    // While the curtains close, keep showing the pick screen behind them.
    if (screen === 'reveal' && curtain && curtain.phase === 'close') screen = 'submit';
    const picks = mk(R.picks);
    if (st.myPick && picks.me) picks.me = st.myPick;
    const byAt = (a: { at?: number }, b: { at?: number }) => (a.at || 0) - (b.at || 0);
    const toppings = Object.entries(R.toppings || {})
      .map(([id, t]) => ({ ...t, id, by: L(t.by) }))
      .sort(byAt);
    const strokes = Object.entries(R.strokes || {})
      .map(([id, t]) => ({
        ...t,
        id,
        by: L(t.by),
        pts: this.drawing && this.drawing.key === id ? this.drawing.pts : asArr(t.pts).map((q) => asArr(q)),
      }))
      .filter((t) => t.pts.length)
      .sort(byAt);
    const pl = Object.fromEntries(players.map((p) => [p.uid, p]));
    const log = Object.entries(R.log || {})
      .map(([id, e]) => ({ ...e, id }))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 6)
      .map((e) => {
        const p = pl[e.by];
        return {
          id: e.id,
          text: (e.by === my ? 'You' : p ? p.name : 'Someone') + ' ' + e.text,
          color: p ? p.color : INK,
          emoji: p ? (CHARS[p.char] || { e: '' }).e : '',
        };
      });
    const tv: Record<string, string | null> = {};
    for (const [k, x] of Object.entries(R.themeVotes || {})) tv[L(k)] = x === '' ? null : x;
    const TR = M.themeResult ? { ...M.themeResult, by: asArr(M.themeResult.by).map(L) } : null;
    const award = (a: unknown): Award | null => {
      const x = asArr(a as string[]);
      return a ? [L(String(x[0])), Number(x[1])] : null;
    };
    const res = M.results ? { best: award(M.results.best), unh: award(M.results.unh), bestTie: !!M.results.bestTie, unhTie: !!M.results.unhTie } : null;
    const me = players.find((p) => p.id === 'me');
    const cake = { ...newCake(), ...(R.cake || {}) };
    return {
      ...st,
      screen,
      code: this.code,
      name: me ? me.name : st.name,
      players,
      picks,
      ready: mk(R.ready),
      locked: !!(R.ready || {})[my as string],
      order: asArr(M.order).map(L),
      idx: M.idx || 0,
      part: M.part || 0,
      reacts: mk(R.reacts),
      cake: { sponge: keyOf(SP, cake.sponge, 'strawberry'), frosting: keyOf(FR, cake.frosting, 'pink'), plate: keyOf(PL, cake.plate, 'plate') },
      cakeBy: Object.fromEntries(Object.entries(R.cakeBy || {}).map(([k, x]) => [k, L(x as string)])),
      toppings,
      strokes,
      log,
      decoReady: mk(R.decoReady),
      revealOk: mk(R.revealOk),
      themeSugs: mk(R.themeSugs),
      themeVotes: tv,
      themeMode: M.themeMode || 'vote',
      themeAgreed: M.themeAgreed || '',
      cakeTheme: M.cakeTheme || '',
      themeStage: M.themeStage || null,
      themeResult: TR,
      themeGo: M.themeGoAt ? Math.max(1, Math.ceil((M.themeGoAt - now) / 1000)) : null,
      decoGo: M.decoGoAt ? Math.max(1, Math.ceil((M.decoGoAt - now) / 1000)) : null,
      curtain,
      results: res,
      finishedAt: M.finishedAt || null,
      pickN: Math.max(1, Object.keys(R.picks || {}).length),
      isHost: hi.host === my,
      hostName: (hi.host && pl[hi.host] ? pl[hi.host].name : '') || '',
      joined: hi.host !== my,
      hasVoted: !!(R.votes || {})[my as string],
      slots: asArr(M.slots),
    };
  }

  // ---- joining & leaving ----------------------------------------------------

  async tryRejoin() {
    const code = this.load('hmo-room'),
      uid = this.state.uid;
    if (!code || !uid || this.state.screen !== 'join' || !this.net) return;
    // An invite link to another room wins over going back to the last one.
    if (this.invite && this.invite !== code) return;
    try {
      const room = (await this.net.get('rooms/' + code)) as Room | null;
      if (room && room.meta && (room.players || {})[uid]) {
        this.setState({ name: room.players![uid].name || this.state.name });
        this.enterRoom(code);
      } else this.save('hmo-room', null);
    } catch {
      /* stay on the join screen */
    }
  }

  async create() {
    const name = this.state.name.trim();
    if (!name) {
      this.setState({ err: 'Pick a nickname first.' });
      return;
    }
    if (!this.net || !this.state.uid) {
      this.waitForConnection('create');
      return;
    }
    this.setState({ busy: true, err: '' });
    try {
      const uid = this.state.uid;
      for (let i = 0; i < 6; i++) {
        const code = Array.from({ length: 4 }, () => ROOM_CODE_LETTERS[Math.floor(Math.random() * ROOM_CODE_LETTERS.length)]).join('');
        // The whole room is written in one go, so scraps of an old room with this code can't sneak into the new one.
        const r = await this.net.tx('rooms/' + code, (cur) =>
          cur && (cur as Room).meta
            ? undefined
            : { meta: { createdAt: this.now(), host: uid, hb: this.now(), phase: 'lobby', themeMode: 'vote', round: 1 }, players: { [uid]: this.seatFor({}) } },
        );
        if (r.committed) {
          this.enterRoom(code);
          return;
        }
      }
      this.setState({ busy: false, err: 'Could not make a room. Try again.' });
    } catch (e) {
      this.setState({ busy: false, err: 'Network error: ' + errMsg(e) });
    }
  }

  async joinRoom() {
    const c = this.state.codeInput,
      name = this.state.name.trim();
    if (c.length !== 4) {
      this.setState({ err: 'Room codes are 4 letters.' });
      return;
    }
    if (!name) {
      this.setState({ err: 'Pick a nickname first.' });
      return;
    }
    if (!this.net || !this.state.uid) {
      this.waitForConnection('join');
      return;
    }
    this.setState({ busy: true, err: '' });
    try {
      const room = (await this.net.get('rooms/' + c)) as Room | null;
      if (!room || !room.meta) {
        this.setState({ busy: false, err: 'No room with that code.' });
        return;
      }
      const ps = room.players || {},
        uid = this.state.uid,
        nick = name.slice(0, 16),
        clash = Object.entries(ps).some(([k, p]) => k !== uid && p.online !== false && sameName(p.name, nick)),
        clashErr = 'Someone in this room is already called ' + nick + '. Try another nickname.';
      if (ps[uid]) {
        if (clash) {
          this.setState({ busy: false, err: clashErr });
          return;
        }
        // Already in this room (refresh, or came back after leaving): take my seat again.
        await this.net.update('rooms/' + c + '/players/' + uid, { name: nick });
        this.enterRoom(c);
        return;
      }
      if ((room.meta.phase || 'lobby') !== 'lobby') {
        this.setState({ busy: false, err: 'That game already started. Join when they start a new round.' });
        return;
      }
      if (Object.values(ps).filter((p) => p.online !== false).length >= MAXP) {
        this.setState({ busy: false, err: 'That room is full (' + MAXP + ' players).' });
        return;
      }
      if (clash) {
        this.setState({ busy: false, err: clashErr });
        return;
      }
      await this.db.set('rooms/' + c + '/players/' + uid, this.seatFor(ps));
      this.enterRoom(c);
    } catch (e) {
      this.setState({ busy: false, err: 'Network error: ' + errMsg(e) });
    }
  }

  /** My seat in a room: a character and color nobody here is using (players who left don't hold theirs). */
  private seatFor(ps: Record<string, PlayerRec>): PlayerRec {
    const on = Object.values(ps).filter((p) => p.online !== false),
      used = new Set(on.map((p) => p.char)),
      usedC = new Set(on.map((p) => p.color)),
      free = CHARS.map((_, i) => i).filter((i) => !used.has(i)),
      now = this.now();
    return {
      name: this.state.name.trim().slice(0, 16),
      char: free.length ? pick(free) : 0,
      charAt: now,
      color: COLORS.find((x) => !usedC.has(x)) || pick(COLORS),
      joinedAt: now,
      online: true,
    };
  }

  private enterRoom(code: string) {
    this.save('hmo-room', code);
    this.save('hmo-name', this.state.name.trim());
    if (this.unwatch) this.unwatch();
    this.seenEv = new Set();
    this.code = code;
    this.mine = null;
    this.beatAt = 0;
    this.setState({ screen: 'room', code, busy: false, err: '', joinNote: '', room: null, myPick: null, votes: { best: null, unh: null }, floaters: [] });
    if (this.stopPresence) this.stopPresence();
    this.stopPresence = this.db.presence(this.rp('players/' + this.state.uid + '/online'));
    this.unwatch = this.db.watch(
      'rooms/' + code,
      (room) => this.onRoom(room as Room | null),
      (e) => this.leave('Could not open that room (' + errMsg(e) + ').', true),
    );
  }

  leave(msg = '', roomGone = false) {
    // Keep the code in the box, so getting back in is one tap (your seat is kept).
    const again = roomGone ? this.state.codeInput : this.code || this.state.codeInput;
    if (this.stopPresence) this.stopPresence();
    this.stopPresence = null;
    if (!roomGone && this.code && this.state.uid && this.state.room) void this.db.set(this.rp('players/' + this.state.uid + '/online'), false);
    if (this.unwatch) this.unwatch();
    this.unwatch = null;
    this.clearTimers();
    this.save('hmo-room', null);
    this.code = '';
    this.mine = null;
    this.drawing = null;
    this.dragging = false;
    this.resizing = null;
    this.rotating = null;
    this.setState({ screen: 'join', room: null, code: '', codeInput: again, myPick: null, err: msg, busy: false });
  }

  // ---- room updates ---------------------------------------------------------

  onRoom(room: Room | null) {
    const uid = this.state.uid as string;
    if (!room || !room.meta || !(room.players || {})[uid]) {
      if (this.state.room) this.leave('That room closed.', true);
      return;
    }
    const prev = this.state.room,
      pm = prev?.meta || {},
      m = room.meta,
      ph: Phase = m.phase || 'lobby',
      patch: Partial<LocalState> = { room };
    if (ph !== pm.phase || (m.round || 1) !== (pm.round || 1)) {
      if (ph === 'decorate') {
        this.myHist = [];
        this.drawing = null;
        patch.tool = 'cherry';
        patch.hint = '';
      }
      if (ph === 'submit' || ph === 'lobby') {
        patch.myPick = null;
        this.mine = null;
        patch.linkVal = '';
        patch.imgErr = false;
        patch.fileErr = false;
      }
      if (ph === 'vote' || ph === 'lobby') patch.votes = { best: null, unh: null };
      if (ph === 'lobby') {
        patch.keepsake = '';
        patch.themeIn = '';
        patch.floaters = [];
      }
      if (ph === 'theme') patch.themeIn = '';
    }
    const cur = 'myPick' in patch ? patch.myPick : this.state.myPick;
    if (ph === 'submit' && !cur && (room.picks || {})[uid]) {
      patch.myPick = { scale: 1, flip: false, labelPos: 'below', rot: 0, ...room.picks![uid] };
      this.mine = patch.myPick;
    }
    // Reactions from the last moment float up from their buttons.
    const nowT = this.now(),
      fl: Floater[] = [];
    for (const [k, e] of Object.entries(room.reactEvents || {})) {
      if (this.seenEv.has(k)) continue;
      this.seenEv.add(k);
      if ((e.at || 0) < nowT - 2500) continue;
      const i = REACTS.findIndex((q) => q[0] === e.k);
      if (i < 0) continue;
      const fid = ++floaterSeq;
      fl.push({
        id: fid,
        k: e.k,
        by: e.by === uid ? 'me' : e.by,
        pick: e.pick === uid ? 'me' : e.pick,
        x: (((i % 3) * 2 + 1) / 6) * 100 + rnd(-7, 7),
        b: i < 3 ? 166 : 70,
        dx: rnd(-45, 45),
        rot: rnd(-25, 25),
        rise: -rnd(230, 340),
        size: rnd(28, 40),
      });
      this.later(() => this.setState((s) => ({ floaters: (s.floaters || []).filter((f) => f.id !== fid) })), 2000);
    }
    if (fl.length) patch.floaters = [...(('floaters' in patch ? patch.floaters : this.state.floaters) || []).slice(-40), ...fl];
    this.setState(patch);
  }

  /** Something on screen counts down, so re-render often. */
  private isLive() {
    const M = this.state.room?.meta;
    if (!M) return false;
    return !!((M.curtainAt && this.now() < M.curtainAt + CURTAIN_TOTAL + 340) || M.themeGoAt || M.decoGoAt);
  }

  onTick() {
    const R = this.state.room;
    if (!R || !R.meta) return;
    if (this.isLive()) this.setState((s) => ({ tick: (s.tick || 0) + 1 }));
    this.hostTick();
  }

  /** The host moves the room along when everyone is ready, and covers for players who left. */
  hostTick() {
    const room = this.state.room;
    if (!room || !room.meta || !this.net) return;
    const hi = this.hostInfo(room);
    if (!hi.host || hi.host !== this.state.uid) return;
    const m = room.meta,
      now = this.now(),
      up = (o: Record<string, unknown>) => void this.db.update(this.rp(), o),
      ids = hi.active.map((p) => p.uid),
      all = (f: (id: string) => unknown) => ids.length > 0 && ids.every(f);
    const u: Record<string, unknown> = this.dedupeSeats(hi.active);
    if (m.host !== hi.host) u['meta/host'] = hi.host;
    // Heartbeat, so everyone can tell my screen is still awake.
    if (m.host !== hi.host || now - this.beatAt >= HOST_BEAT_MS) {
      this.beatAt = now;
      u['meta/hb'] = now;
    }
    if (Object.keys(u).length) up(u);
    if ((m.phase || 'lobby') === 'lobby') return;
    if (m.phase === 'theme') {
      const st = m.themeStage;
      if (st === 'suggest') {
        const ok = all((id) => (room.themeSugs || {})[id]);
        if (ok && !m.sugDoneAt) up({ 'meta/sugDoneAt': now + 1200 });
        else if (!ok && m.sugDoneAt) up({ 'meta/sugDoneAt': null });
        else if (ok && m.sugDoneAt && now >= m.sugDoneAt) this.startThemeVote();
      } else if (st === 'vote') {
        const ok = all((id) => id in (room.themeVotes || {}));
        if (ok && !m.voteDoneAt) up({ 'meta/voteDoneAt': now + 900 });
        else if (!ok && m.voteDoneAt) up({ 'meta/voteDoneAt': null });
        else if (ok && m.voteDoneAt && now >= m.voteDoneAt) this.finishTheme();
      } else if (st === 'result' && m.themeGoAt && now >= m.themeGoAt) this.startDecorate();
      return;
    }
    if (m.phase === 'decorate') {
      const ok = all((id) => (room.decoReady || {})[id]);
      if (ok && !m.decoGoAt) up({ 'meta/decoGoAt': now + 3000 });
      else if (!ok && m.decoGoAt) up({ 'meta/decoGoAt': null });
      else if (ok && m.decoGoAt && now >= m.decoGoAt) this.startPicks();
      return;
    }
    if (m.phase === 'submit') {
      // Nobody can start the reveal alone: it begins once everyone has locked in and said they're ready.
      if (!m.curtainAt && all((id) => (room.ready || {})[id] && (room.revealOk || {})[id])) this.startReveal();
      return;
    }
    if (m.phase === 'reveal') {
      if (m.curtainAt && now < m.curtainAt + CURTAIN_TOTAL) return;
      const id = asArr(m.order)[m.idx || 0];
      if (!id || ids.includes(id)) return;
      // The presenter left: show their pick for them, one part every 2 seconds.
      if (!this.autoAt || now >= this.autoAt) {
        this.autoAt = now + 2000;
        if ((m.part || 0) < this.partsOfUid(id).length) this.advancePart(true);
      }
      return;
    }
    if (m.phase === 'vote') {
      const vs = room.votes || {};
      // Someone whose own pick is the only one shown has nothing to vote on, so nobody waits for them.
      if (all((id) => vs[id] || !this.hasVoteCards(id, room))) this.tallyVotes();
    }
  }

  /**
   * Two players on one character or color (picked at the same moment, or someone came back and found theirs taken):
   * the most recent character choice keeps it and the other gets a free one; for colors, whoever joined first keeps it.
   */
  private dedupeSeats(active: (PlayerRec & { uid: string })[]) {
    const u: Record<string, unknown> = {},
      usedK = new Set<number | undefined>(),
      usedC = new Set<string | undefined>(),
      newestFirst = [...active].sort((a, b) => (b.charAt ?? b.joinedAt ?? 0) - (a.charAt ?? a.joinedAt ?? 0) || (a.uid < b.uid ? -1 : 1));
    for (const p of newestFirst) {
      if (!usedK.has(p.char)) {
        usedK.add(p.char);
        continue;
      }
      const f = CHARS.map((_, i) => i).find((i) => !usedK.has(i) && !active.some((q) => q.char === i));
      if (f != null) {
        u['players/' + p.uid + '/char'] = f;
        usedK.add(f);
      }
    }
    for (const p of active) {
      if (!usedC.has(p.color)) {
        usedC.add(p.color);
        continue;
      }
      const c = COLORS.find((x) => !usedC.has(x) && !active.some((q) => q.color === x));
      if (c) {
        u['players/' + p.uid + '/color'] = c;
        usedC.add(c);
      }
    }
    return u;
  }
  /** Whether `uid` has anything to vote on: some revealed pick that isn't theirs. */
  private hasVoteCards(uid: string, room: Room | null = this.state.room) {
    return asArr(room?.meta?.order).some((o) => o !== uid);
  }

  /**
   * Moves the room on with a transaction on its meta, so if two players act as host at the same moment
   * only one of them does it. `fn` returns the new meta, or undefined if the room has already moved on.
   */
  private async metaTx(key: string, fn: (m: Meta) => Meta | undefined): Promise<boolean> {
    if (this.inflight.has(key) || !this.net) return false;
    this.inflight.add(key);
    try {
      const r = await this.net.tx(this.rp('meta'), (cur) => (cur ? fn(cur as Meta) : undefined));
      return r.committed;
    } catch {
      return false;
    } finally {
      this.inflight.delete(key);
    }
  }

  // ---- lobby ----------------------------------------------------------------

  pickChar(ci: number) {
    const v = this.view();
    if (v.screen !== 'lobby' || !CHARS[ci] || v.players.some((p) => p.id !== 'me' && p.online && p.char === ci)) return;
    void this.db.update(this.rp('players/' + this.state.uid), { char: ci, charAt: this.now() });
  }
  setThemeMode(k: ThemeMode) {
    if (this.amHost() && this.view().screen === 'lobby') void this.db.set(this.rp('meta/themeMode'), k);
  }
  setThemeAgreed(t: string) {
    if (this.amHost() && this.view().screen === 'lobby') void this.db.set(this.rp('meta/themeAgreed'), String(t || '').slice(0, 40));
  }
  startGame() {
    const v = this.view();
    if (v.screen !== 'lobby' || !this.amHost() || v.players.filter((p) => p.online).length < MINP) return;
    const t = cleanTheme(v.themeAgreed);
    if (v.themeMode === 'agreed' && !t) return;
    // A fresh heartbeat goes out with the start, so nobody mistakes a host who was away in the lobby for one who left.
    this.beatAt = this.now();
    // Clear the last cake now, while nobody can be decorating yet.
    const freshCake = { 'meta/hb': this.beatAt, cake: null, cakeBy: null, toppings: null, strokes: null, log: null, decoReady: null };
    if (v.themeMode === 'agreed') {
      void this.db.update(this.rp(), freshCake);
      this.startDecorate(t);
      return;
    }
    void this.db.update(this.rp(), {
      ...freshCake,
      'meta/phase': 'theme',
      'meta/themeStage': 'suggest',
      'meta/sugDoneAt': null,
      'meta/voteDoneAt': null,
      'meta/themeResult': null,
      'meta/themeGoAt': null,
      'meta/cakeTheme': '',
      themeSugs: null,
      themeVotes: null,
    });
  }

  // ---- theme ----------------------------------------------------------------

  setSug(text: string) {
    const v = this.view();
    if (v.screen !== 'theme' || v.themeStage !== 'suggest') return;
    const t = cleanTheme(text);
    void this.db.set(this.rp('themeSugs/' + this.state.uid), t || null);
  }
  submitSug() {
    this.setSug(this.state.themeIn);
  }
  /** Take my suggestion back into the text box so I can edit it. */
  changeSug() {
    this.setState({ themeIn: this.view().themeSugs.me || '' });
    this.setSug('');
  }
  /** Distinct ideas (case/spacing-insensitive) with everyone who suggested each. */
  themeOpts(s: View = this.view()): ThemeOption[] {
    const m = new Map<string, ThemeOption>();
    for (const p of s.players) {
      const t = s.themeSugs[p.id];
      if (!t) continue;
      const k = normTheme(t);
      if (!m.has(k)) m.set(k, { key: k, text: t, by: [] });
      m.get(k)!.by.push(p.id);
    }
    return [...m.values()];
  }
  private startThemeVote() {
    // Everyone suggested the same thing: no need to vote.
    if (this.themeOpts().length < 2) {
      this.finishTheme();
      return;
    }
    // Votes were cleared when the theme step started, so only the stage changes here.
    void this.metaTx('tv', (m) => (m.phase === 'theme' && m.themeStage === 'suggest' ? { ...m, themeStage: 'vote', voteDoneAt: null } : undefined));
  }
  /** Vote for an idea (null = abstain, when every idea is mine). You can't vote for your own. */
  castThemeVote(key: string | null) {
    const v = this.view();
    if (v.screen !== 'theme' || v.themeStage !== 'vote') return;
    if (key != null) {
      const o = this.themeOpts(v).find((x) => x.key === key);
      if (!o || o.by.includes('me')) return;
    }
    void this.db.set(this.rp('themeVotes/' + this.state.uid), key == null ? '' : key);
  }
  private finishTheme() {
    const v = this.view(),
      opts = this.themeOpts(v);
    if (!opts.length) return;
    const tally = (k: string) => Object.values(v.themeVotes).filter((x) => x === k).length,
      top = Math.max(...opts.map((o) => tally(o.key))),
      best = opts.filter((o) => tally(o.key) === top),
      w = pick(best),
      result = { text: w.text, by: w.by.map((id) => this.uidOf(id)), votes: top, tie: best.length > 1, consensus: opts.length === 1 };
    void this.metaTx('tf', (m) =>
      m.phase === 'theme' && (m.themeStage === 'suggest' || m.themeStage === 'vote')
        ? { ...m, themeStage: 'result', cakeTheme: w.text, themeResult: result, themeGoAt: this.now() + 3000 }
        : undefined,
    );
  }

  // ---- decorate -------------------------------------------------------------

  /** From the theme result, or straight from the lobby with the theme everyone already agreed on. */
  private startDecorate(agreedTheme?: string) {
    void this.metaTx('dec', (m) => {
      if (agreedTheme != null)
        return (m.phase || 'lobby') === 'lobby'
          ? { ...m, phase: 'decorate', cakeTheme: agreedTheme, themeResult: null, themeStage: null, decoGoAt: null, themeGoAt: null, hb: this.beatAt || this.now() }
          : undefined;
      return m.phase === 'theme' && m.themeStage === 'result' ? { ...m, phase: 'decorate', decoGoAt: null, themeGoAt: null } : undefined;
    });
  }
  private addLog(text: string) {
    this.db.push(this.rp('log'), { by: this.state.uid, text, at: this.now() });
  }
  setCake(k: CakePart, val: string) {
    const M = { sponge: SP, frosting: FR, plate: PL }[k] as Record<string, { label: string }>;
    if (!M[val]) return;
    void this.db.update(this.rp(), { ['cake/' + k]: val, ['cakeBy/' + k]: this.state.uid });
    this.addLog('switched the ' + k + ' to ' + M[val].label);
  }
  /** Change the sponge/frosting/plate, unless it's already that or I'm done decorating. */
  chooseCake(k: CakePart, val: string) {
    const w = this.view();
    if (w.cake[k] !== val && !w.decoReady.me) this.setCake(k, val);
  }
  setTool(tool: ToolKey) {
    this.setState({ tool, hint: '' });
  }
  setPen(pen: PenKey) {
    this.setState({ pen });
  }
  private addTopping(type: ToppingType, x: number, y: number) {
    const key = this.db.push(this.rp('toppings'), { type, x, y, by: this.state.uid, rot: rnd(-40, 40), stripe: pick(STRIPES), at: this.now() });
    this.addLog('added ' + NOUN[type]);
    return key;
  }
  removeTopping(key: string) {
    this.myHist = this.myHist.filter((q) => q !== 'toppings/' + key);
    void this.db.remove(this.rp('toppings/' + key));
  }
  setDecoReady(on: boolean) {
    const v = this.view();
    if (v.screen !== 'decorate') return;
    if (on) {
      this.drawing = null;
      this.setState({ hint: '' });
    }
    const u: Record<string, unknown> = { ['decoReady/' + this.state.uid]: on ? true : null };
    if (!on) u['meta/decoGoAt'] = null;
    void this.db.update(this.rp(), u);
  }
  /** Pointer down on the cake while decorating: add a topping or start a frosting line. */
  onCakeDown(e: { clientX: number; clientY: number; preventDefault?: () => void }) {
    const v = this.view();
    if (v.screen !== 'decorate' || v.decoReady.me || !this.cakeEl) return;
    const r = this.cakeEl.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * 100,
      y = ((e.clientY - r.top) / r.height) * 100,
      s = this.state;
    if (!inCake(x, y)) return;
    if (s.tool === 'pen') {
      e.preventDefault?.();
      const pts = [
          [x, y * 1.05],
          [x + 0.01, y * 1.05],
        ],
        key = this.db.push(this.rp('strokes'), { by: s.uid, color: PENS[s.pen][1], pts, at: this.now() });
      this.drawing = { key, pts };
      this.myHist.push('strokes/' + key);
      this.addLog('drew on the cake');
      return;
    }
    if (s.tool === 'candle' && !inTop(x, y)) {
      this.setState({ hint: 'Candles go on top of the cake.' });
      return;
    }
    const key = this.addTopping(s.tool, x, y);
    this.myHist.push('toppings/' + key);
    if (s.hint) this.setState({ hint: '' });
  }
  canUndo() {
    return this.myHist.length > 0;
  }
  undo() {
    const p = this.myHist.pop();
    if (p) void this.db.remove(this.rp(p));
    this.forceUpdate();
  }

  // ---- pick -----------------------------------------------------------------

  private startPicks() {
    const hi = this.hostInfo(),
      ps = hi.active.map((p) => ({ id: p.uid })),
      lay = layoutPicks(ps) || {},
      picks: Record<string, PickRec> = {};
    ps.forEach((p, i) => {
      picks[p.id] = {
        ...(lay[p.id] || { x: 25 + (50 * i) / Math.max(1, ps.length - 1), y: 58, stick: 9.5, scale: 1, rot: 0 }),
        flip: false,
        labelPos: 'below',
        moving: false,
      };
    });
    void this.metaTx('picks', (m) =>
      m.phase === 'decorate' && m.decoGoAt && this.now() >= m.decoGoAt
        ? { ...m, phase: 'submit', decoGoAt: null, slots: Object.values(lay), curtainAt: null, order: null, idx: 0, part: 0 }
        : undefined,
    ).then((ok) => {
      if (!ok) return;
      const u: Record<string, unknown> = { ready: null, revealOk: null, reacts: null, reactEvents: null, votes: null };
      // Field by field, so a picture someone has already added isn't wiped.
      for (const [id, p] of Object.entries(picks)) for (const [k, x] of Object.entries(p)) u['picks/' + id + '/' + k] = x;
      void this.db.update(this.rp(), u);
    });
  }
  /** Change my pick locally right away; the room hears about it at most every 120ms. */
  updMine(p: Partial<PickRec>) {
    const next = { ...DEFAULT_PICK, ...(this.mine || this.state.myPick || {}), ...p };
    this.mine = next;
    this.setState({ myPick: next });
    if (!this.syncT)
      this.syncT = this.env.setTimeout(() => {
        this.syncT = null;
        this.syncMine();
      }, 120);
  }
  private syncMine() {
    const m = this.mine;
    if (!m || !this.code) return;
    // The picture is sent once by setImg, not with every nudge.
    const { img: _img, ...rest } = m;
    void this.db.update(this.rp('picks/' + this.state.uid), { ...rest, moving: !!(this.dragging || this.resizing || this.rotating) });
  }
  setImg(src: string) {
    this.updMine({ img: src });
    void this.db.set(this.rp('picks/' + this.state.uid + '/img'), src);
    this.setState({ imgErr: false, fileErr: false });
    this.env.probeImage(src, () => {
      if ((this.mine || {}).img === src) this.setState({ imgErr: true });
    });
  }
  /** Use a picture file (upload, drop or paste), shrunk first so it sends fast. */
  readFile(f: File | null | undefined) {
    if (!f) return;
    // A file that says it isn't a picture: tell the player instead of quietly ignoring it.
    // (No type at all can still be a picture, so that one gets a try.)
    if (f.type && !f.type.startsWith('image/')) {
      this.setState({ fileErr: true });
      return;
    }
    this.setState({ hint: 'Shrinking your picture…', fileErr: false });
    void shrinkImage(f).then((d) => {
      this.setState({ hint: '' });
      if (d) this.setImg(d);
      else this.setState({ imgErr: true });
    });
  }
  /** Use the address typed into the link box. */
  useLink() {
    const u = this.state.linkVal.trim();
    if (u) this.setImg(u);
  }
  /** Picks of others that my card currently overlaps. */
  mineClashes(s: View = this.view()) {
    const me = s.picks.me;
    if (!me) return [];
    const n = s.pickN;
    return Object.entries(s.picks)
      .filter(([k, o]) => k !== 'me' && !o.moving && pickClash(me, o, n))
      .map(([k]) => k);
  }
  /** After a drag, slide my pick to the nearest spot that doesn't overlap anyone. */
  private settleMine() {
    const s = this.view(),
      me = this.mine;
    if (!me) return;
    const others = Object.entries(s.picks)
        .filter(([k, o]) => k !== 'me' && !o.moving)
        .map(([, o]) => o),
      q = freeSpotFor(me, others, s.pickN, s.slots);
    if (q !== me) {
      this.mine = q;
      this.setState({ myPick: q, hint: 'Moved your pick to a free spot.' });
    }
    this.syncMine();
  }
  allLocked(s: View = this.view()) {
    const on = s.players.filter((p) => p.online);
    return on.length > 0 && on.every((p) => s.ready[p.id]);
  }
  /** Everyone still here has locked in and said they're ready for the reveal. */
  allRevealOk(s: View = this.view()) {
    const on = s.players.filter((p) => p.online);
    return on.length > 0 && on.every((p) => s.ready[p.id] && s.revealOk[p.id]);
  }
  lockIn() {
    const v = this.view(),
      me = v.picks.me;
    if (v.screen !== 'submit' || v.curtain || !me || !me.img || this.state.imgErr) return;
    this.settleMine();
    void this.db.set(this.rp('ready/' + this.state.uid), true);
  }
  /** Undoing the lock-in also takes back my OK for the reveal. Not once the curtains have started closing. */
  unlock() {
    const v = this.view();
    if (v.screen !== 'submit' || v.curtain) return;
    void this.db.update(this.rp(), { ['ready/' + this.state.uid]: null, ['revealOk/' + this.state.uid]: null });
  }
  /** Say I'm ready (or not yet) for the reveal. Only once my pick is locked in. */
  setRevealOk(on: boolean) {
    const v = this.view();
    if (v.screen !== 'submit' || v.curtain || (on && !v.locked)) return;
    void this.db.set(this.rp('revealOk/' + this.state.uid), on ? true : null);
  }

  // Pointer gestures on my pick card (pick screen). `f` is where the card stands.
  grabMine(e: { clientX: number; clientY: number }, f: { x: number; y: number }) {
    if (!this.cakeEl) return;
    const r = this.cakeEl.getBoundingClientRect();
    this.dragOff = { x: e.clientX - (r.left + (f.x / 100) * r.width), y: e.clientY - (r.top + (f.y / 100) * r.height) };
    this.dragging = true;
  }
  rotateMine(e: { clientX: number; clientY: number }, f: { x: number; y: number; rot?: number }) {
    if (!this.cakeEl) return;
    const r = this.cakeEl.getBoundingClientRect(),
      bx = r.left + (f.x / 100) * r.width,
      by = r.top + (f.y / 100) * r.height;
    this.rotating = { bx, by, r0: f.rot || 0, a0: (Math.atan2(e.clientX - bx, -(e.clientY - by)) * 180) / Math.PI };
  }
  resizeMine(e: { clientX: number; clientY: number }, f: { x: number; y: number }, scale: number) {
    if (!this.cakeEl) return;
    const r = this.cakeEl.getBoundingClientRect(),
      bx = r.left + (f.x / 100) * r.width,
      by = r.top + (f.y / 100) * r.height;
    this.resizing = { bx, by, s: scale, d0: Math.max(20, Math.hypot(e.clientX - bx, e.clientY - by)) };
  }
  flipMine() {
    this.updMine({ flip: !(this.mine || this.state.myPick || {}).flip });
  }

  /** Pointer moved anywhere on the page: continue a frosting line or a drag/resize/rotate of my pick. */
  onPointerMove(e: { clientX: number; clientY: number }) {
    if (!this.cakeEl) return;
    const r = this.cakeEl.getBoundingClientRect();
    if (this.drawing) {
      const d = this.drawing,
        x = ((e.clientX - r.left) / r.width) * 100,
        y = ((e.clientY - r.top) / r.height) * 105,
        l = d.pts[d.pts.length - 1];
      if (Math.hypot(l[0] - x, l[1] - y) < 0.6) return;
      d.pts.push([x, y]);
      this.forceUpdate();
      if (!this.strokeT)
        this.strokeT = this.env.setTimeout(() => {
          this.strokeT = null;
          if (this.drawing) void this.db.set(this.rp('strokes/' + this.drawing.key + '/pts'), this.drawing.pts);
        }, 120);
      return;
    }
    if (this.rotating) {
      const z = this.rotating,
        ang = (Math.atan2(e.clientX - z.bx, -(e.clientY - z.by)) * 180) / Math.PI;
      let d = ang - z.a0;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      this.updMine({ rot: Math.max(-90, Math.min(90, z.r0 + d)) });
      return;
    }
    if (this.resizing) {
      const z = this.resizing,
        d = Math.hypot(e.clientX - z.bx, e.clientY - z.by);
      this.updMine({ scale: Math.min(1.8, Math.max(0.5, (z.s * d) / z.d0)) });
      return;
    }
    if (!this.dragging) return;
    const o = this.dragOff;
    let x = ((e.clientX - o.x - r.left) / r.width) * 100,
      y = ((e.clientY - o.y - r.top) / r.height) * 100;
    // Keep the stick on the top of the cake.
    const d = Math.hypot((x - GX) / (GRX * 0.9), (y - GT) / (GRY * 0.85));
    if (d > 1) {
      x = GX + (x - GX) / d;
      y = GT + (y - GT) / d;
    }
    this.updMine({ x, y });
  }

  onPointerUp() {
    const was = this.dragging || this.resizing || this.rotating;
    this.dragging = false;
    this.resizing = null;
    this.rotating = null;
    if (this.drawing) {
      const d = this.drawing;
      this.drawing = null;
      void this.db.set(this.rp('strokes/' + d.key + '/pts'), d.pts);
    }
    if (was && this.view().screen === 'submit') this.settleMine();
  }

  // ---- reveal ---------------------------------------------------------------

  /** Close the curtains and start the countdown. The host does this once everyone has said they're ready. */
  private startReveal() {
    const v = this.view();
    if (v.screen !== 'submit' || v.curtain || !this.allRevealOk(v)) return;
    const R = this.state.room!;
    const order = shuffle(Object.keys(R.ready || {}).filter((id) => (R.picks || {})[id] && (R.players || {})[id]));
    void this.metaTx('reveal', (m) => (m.phase === 'submit' && !m.curtainAt ? { ...m, phase: 'reveal', order, idx: 0, part: 0, curtainAt: this.now() } : undefined));
  }
  /** A pick is shown in parts: picture, name, then each line of the defense. */
  partsOfUid(uid: string) {
    const p = (this.state.room?.picks || {})[uid] || {};
    return ['img', 'label', ...capLines(p.caption)];
  }
  partsOf(id: string) {
    return this.partsOfUid(this.uidOf(id));
  }
  /** Show the next part of the current pick. Only its owner may, unless `force` (host covering). */
  private advancePart(force: boolean) {
    const v = this.view();
    if (v.screen !== 'reveal' || v.curtain) return 0;
    const id = v.order[v.idx];
    if (!id || (!force && id !== 'me')) return 0;
    const tot = this.partsOf(id).length,
      cur = v.part || 0;
    if (cur >= tot) return 0;
    const idx = v.idx;
    void this.db.tx(this.rp('meta'), (raw) => {
      const m = raw as Room['meta'];
      if (!m || m.phase !== 'reveal' || (m.idx || 0) !== idx || (m.part || 0) !== cur) return undefined;
      return { ...m, part: cur + 1 };
    });
    return cur + 1;
  }
  presentNext() {
    return this.advancePart(false);
  }
  /** Who may move on to the next pick: its owner, the host, or anyone if the owner left. */
  canNext(v: View = this.view()) {
    const id = v.order[v.idx];
    return !!id && (id === 'me' || v.isHost || !(v.players.find((p) => p.id === id) || { online: false }).online);
  }
  nextReveal() {
    const v = this.view();
    if (v.screen !== 'reveal' || v.curtain) return;
    const id = v.order[v.idx];
    if (!id || (v.part || 0) < this.partsOf(id).length || !this.canNext(v)) return;
    const idx = v.idx,
      len = v.order.length;
    void this.db.tx(this.rp('meta'), (raw) => {
      const m = raw as Room['meta'];
      if (!m || m.phase !== 'reveal' || (m.idx || 0) !== idx) return undefined;
      return idx < len - 1 ? { ...m, idx: idx + 1, part: 0 } : { ...m, phase: 'vote' };
    });
  }
  react(k: ReactKey) {
    const v = this.view(),
      id = v.order[v.idx];
    if (!id || v.screen !== 'reveal' || v.curtain || (v.part || 0) < 1) return;
    const pu = this.uidOf(id);
    void this.db.tx(this.rp('reacts/' + pu + '/' + k), (c) => ((c as number) || 0) + 1);
    this.db.push(this.rp('reactEvents'), { k, by: this.state.uid, pick: pu, at: this.now() });
  }

  // ---- vote & results -------------------------------------------------------

  /** Pick my Best / Most unhinged. Locked once my votes are in. */
  chooseVote(kind: 'best' | 'unh', id: string) {
    const v = this.view();
    if (v.screen !== 'vote' || v.hasVoted) return;
    this.setState((st) => ({ votes: { ...st.votes, [kind]: id } }));
  }
  submitVotes() {
    const v = this.state.votes;
    if (!v.best || !v.unh || this.view().hasVoted) return;
    void this.db.set(this.rp('votes/' + this.state.uid), { best: this.uidOf(v.best), unh: this.uidOf(v.unh) });
  }
  private tallyVotes() {
    const room = this.state.room!,
      t: Record<'best' | 'unh', Record<string, number>> = { best: {}, unh: {} };
    for (const x of Object.values(room.votes || {})) {
      if (x.best) t.best[x.best] = (t.best[x.best] || 0) + 1;
      if (x.unh) t.unh[x.unh] = (t.unh[x.unh] || 0) + 1;
    }
    // Most votes wins. A tie is broken at random among the tied picks (like the theme vote), and flagged so it can say so.
    const top = (c: 'best' | 'unh') => {
      const e = Object.entries(t[c]);
      if (!e.length) return { award: null, tie: false };
      const most = Math.max(...e.map(([, n]) => n)),
        tied = e.filter(([, n]) => n === most);
      return { award: [pick(tied)[0], most] as Award, tie: tied.length > 1 };
    };
    const b = top('best'),
      h = top('unh');
    void this.metaTx('tally', (m) =>
      m.phase === 'vote'
        ? { ...m, phase: 'results', results: { best: b.award, unh: h.award, bestTie: b.tie, unhTie: h.tie }, finishedAt: this.now() }
        : undefined,
    );
  }
  /** Back to the lobby for another round with the same people. */
  playAgain() {
    if (this.view().screen !== 'results') return;
    const m = this.state.room?.meta || {};
    this.myHist = [];
    void this.db.update(this.rp(), {
      'meta/phase': 'lobby',
      'meta/round': (m.round || 1) + 1,
      'meta/themeStage': null,
      'meta/cakeTheme': '',
      'meta/themeResult': null,
      'meta/results': null,
      'meta/finishedAt': null,
      'meta/order': null,
      'meta/idx': 0,
      'meta/part': 0,
      'meta/curtainAt': null,
      'meta/slots': null,
      'meta/decoGoAt': null,
      'meta/themeGoAt': null,
      'meta/sugDoneAt': null,
      'meta/voteDoneAt': null,
      themeSugs: null,
      themeVotes: null,
      picks: null,
      ready: null,
      revealOk: null,
      reacts: null,
      reactEvents: null,
      votes: null,
      toppings: null,
      strokes: null,
      log: null,
      decoReady: null,
      cake: null,
      cakeBy: null,
    });
  }

  // ---- keyboard & clipboard -------------------------------------------------

  /** Space / Enter / → / PageDown shows the next part while I'm presenting. */
  onKeyDown(e: { key: string; repeat?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; target?: EventTarget | null; preventDefault?: () => void }) {
    if (this.view().screen !== 'reveal' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = (e.target || {}) as { tagName?: string; isContentEditable?: boolean },
      tag = String(t.tagName || '').toLowerCase(),
      k = e.key;
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    if (k !== ' ' && k !== 'Enter' && k !== 'ArrowRight' && k !== 'PageDown') return;
    if ((k === ' ' || k === 'Enter') && tag === 'button') return;
    if (this.presentNext()) e.preventDefault?.();
  }

  /** Paste a picture (or a picture link) anywhere while picking. */
  onPaste(e: ClipboardEvent) {
    const v = this.view();
    if (v.screen !== 'submit' || v.locked) return;
    const items = [...(e.clipboardData?.items || [])];
    const im = items.find((i) => i.type.startsWith('image/'));
    if (im) {
      e.preventDefault();
      this.readFile(im.getAsFile());
      return;
    }
    const text = e.clipboardData?.getData('text');
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (text && /^https?:\/\//.test(text.trim()) && !['INPUT', 'TEXTAREA'].includes(active?.tagName || '')) {
      this.setImg(text.trim());
      this.setState({ linkVal: text.trim() });
    }
  }

  // ---- keepsake -------------------------------------------------------------

  /** Download the finished cake, awards and every pick as a standalone .html page. */
  async exportKeepsake() {
    const s = this.view(),
      stage = this.cakeEl && this.cakeEl.parentElement;
    if (!stage || s.keepsake === 'working') return;
    this.setState({ keepsake: 'working' });
    try {
      const { html, name } = await buildKeepsake(s, stage);
      downloadHtml(name, html);
      this.setState({ keepsake: 'done', keepsakeName: name });
    } catch (e) {
      console.error(e);
      this.setState({ keepsake: 'error' });
    }
  }
}
