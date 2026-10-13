// Bug fixes and quality-of-life changes (F1–F24). Each check fails on the code from before its fix.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController, type GameEnv } from '../src/game/controller';
import { buildKeepsake } from '../src/game/keepsake';
import type { Room } from '../src/game/types';
import { normCode, recipeLine, sameName, signInTrouble } from '../src/game/util';
import { buildViewModel } from '../src/game/viewModel';
import { memoryNet } from '../src/net/core';
import { buildOf, isNewerBuild } from '../src/updateCheck';
import { H, W, World, client, playDecorate, playPick, playReveal, playTheme, setup, type Client } from './world';

afterEach(() => {
  vi.restoreAllMocks();
});

const meta = (w: World, code: string) => (w.core.get('rooms/' + code + '/meta') || {}) as NonNullable<Room['meta']>;

/** A player built by hand: `connectMs` until the connection is up (Infinity = never), optional invite link, saved storage. */
function player(w: World, uid: string, opt: { connectMs?: number; invite?: string; store?: Record<string, string> } = {}): Client {
  const net = memoryNet(w.core, { uid, defer: (f) => void w.setT(f, 0), now: () => w.now });
  const store = opt.store || {};
  const ms = opt.connectMs ?? 0;
  const env: GameEnv = {
    createNet: () =>
      new Promise((r) => {
        if (Number.isFinite(ms)) w.setT(() => r(net), ms);
      }),
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
    probeImage: () => {},
  };
  const c = new GameController(env);
  if (opt.invite != null) c.useInvite(opt.invite);
  c.start();
  c.cakeEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }) };
  return { c, net, uid, store, V: () => buildViewModel(c), S: () => c.view(), up: () => c.onPointerUp() };
}

/** Stops a player's game loop, like a phone that was locked or switched to another app (still connected). */
const freeze = (w: World, k: Client) => w.clrT((k.c as unknown as { tickT: number }).tickT);
/** The frozen screen comes back to life. */
const wake = (k: Client) => {
  (k.c as unknown as { started: boolean }).started = false;
  k.c.start();
};

/** Plays a room from the lobby to the vote screen. */
async function toVote(n: number) {
  const f: string[] = [];
  const s = await setup(n);
  expect(await playTheme(s.w, s.cs, f, 'v'), f.join('\n')).toBe(true);
  expect(await playDecorate(s.w, s.cs, f, 'v'), f.join('\n')).toBe(true);
  expect(await playPick(s.w, s.cs, f, 'v'), f.join('\n')).toBe(true);
  expect(await playReveal(s.w, s.cs, f, 'v'), f.join('\n')).toBe(true);
  return s;
}

describe('fixes', () => {
  it('F1 Create or Join pressed while still connecting goes through by itself, or explains after 15 s', async () => {
    const w = new World();
    const host = client(w, 'u0');
    await w.run(50);
    host.c.setState({ name: 'Sam' });
    await host.c.create();
    await w.run(100);
    const code = host.c.code;

    const a = player(w, 'u1', { connectMs: 2000 });
    a.c.setState({ name: 'Alex' });
    await a.c.create(); // pressed before the connection is up
    const waiting = { busy: a.c.state.busy, note: a.V().join.note, err: a.c.state.err, screen: a.S().screen };
    await w.run(2500);

    const b = player(w, 'u2', { connectMs: 1500 });
    b.c.setState({ name: 'Bo', codeInput: code });
    await b.c.joinRoom();
    await w.run(2000);

    const never = player(w, 'u3', { connectMs: Infinity });
    never.c.setState({ name: 'Nobody' });
    await never.c.create();
    await w.run(16000);

    expect(waiting).toEqual({ busy: true, note: expect.stringMatching(/^Still connecting/), err: '', screen: 'join' });
    expect(a.S().screen).toBe('lobby');
    expect(a.c.code).toMatch(/^[A-Z]{4}$/);
    expect(b.S().screen).toBe('lobby');
    expect(b.c.code).toBe(code);
    expect(never.S().screen).toBe('join');
    expect(never.c.state.busy).toBe(false);
    expect(never.c.state.err).toMatch(/^Still connecting\. Check your internet/);
  });

  it('F2 a tied vote is broken at random among the tied picks and says so; a clear win says nothing', async () => {
    // Each player gives Best to the next player and Most unhinged to the one before: one vote each, all tied.
    const tied = async (rand: number) => {
      const { w, cs, code } = await toVote(3);
      cs.forEach((k, i) => {
        k.c.chooseVote('best', 'u' + ((i + 1) % 3));
        k.c.chooseVote('unh', 'u' + ((i + 2) % 3));
        k.c.submitVotes();
      });
      vi.spyOn(Math, 'random').mockReturnValue(rand);
      await w.until(() => cs.every((k) => k.S().screen === 'results'), 5000);
      vi.restoreAllMocks();
      return { r: meta(w, code).results!, subs: cs[0].V().results.winners.map((x) => x.sub) };
    };
    const lo = await tied(0),
      hi = await tied(0.999);
    expect(lo.r.bestTie).toBe(true);
    expect(lo.r.unhTie).toBe(true);
    expect((lo.r.best as unknown[])[1]).toBe(1);
    expect(lo.subs.every((x) => x.endsWith('· Tie broken at random'))).toBe(true);
    // Random, not always the same player: the two draws pick different winners.
    expect((lo.r.best as unknown[])[0]).not.toBe((hi.r.best as unknown[])[0]);

    const { w, cs, code } = await toVote(3);
    cs[0].c.chooseVote('best', 'u1');
    cs[0].c.chooseVote('unh', 'u2');
    cs[1].c.chooseVote('best', 'u2');
    cs[1].c.chooseVote('unh', 'u0');
    cs[2].c.chooseVote('best', 'u1');
    cs[2].c.chooseVote('unh', 'u0');
    cs.forEach((k) => k.c.submitVotes());
    await w.until(() => cs.every((k) => k.S().screen === 'results'), 5000);
    const r = meta(w, code).results!;
    expect([r.best, r.bestTie, r.unh, r.unhTie]).toEqual([['u1', 2], false, ['u0', 2], false]);
    expect(cs[2].V().results.winners.some((x) => /Tie/.test(x.sub))).toBe(false);
  });

  it('F3 a pick saved without a name is "<owner>\'s pick" for everyone, not blank', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(3);
    expect(await playTheme(w, cs, f, 'n'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'n'), f.join('\n')).toBe(true);
    for (const k of cs) {
      k.c.setImg('https://img.test/' + k.uid + '.png');
      k.c.updMine({ label: k.uid === 'u1' ? '' : 'Named ' + k.uid });
    }
    await w.run(400);
    for (const k of cs) k.c.lockIn();
    await w.run(300);
    for (const k of cs) k.c.setRevealOk(true);
    expect(await w.until(() => cs.every((k) => k.S().screen === 'reveal' && !k.S().curtain), 12000)).toBe(true);
    // Watch the reveal of u1's pick from u0's screen once its name part is out.
    let seen = '';
    for (let g = 0; g < 200 && cs[0].S().screen === 'reveal'; g++) {
      const v = cs[0].S();
      if (v.order[v.idx] === 'u1' && (v.part || 0) >= 2) seen = cs[0].V().reveal.cur!.label;
      const pres = cs.find((k) => k.S().order[k.S().idx] === 'me');
      if (pres && (pres.S().part || 0) < pres.c.partsOf('me').length) pres.c.presentNext();
      else if (pres) pres.c.nextReveal();
      await w.run(80);
    }
    expect(seen).toBe("P1's pick");
    expect(cs[2].V().vote.cards.find((c) => c.id === 'u1')!.label).toBe("P1's pick");
  });

  it("F4 a player who left doesn't hold their character, and when they come back the newest choice keeps it", async () => {
    const { w, cs, code } = await setup(3);
    const x = cs[1].S().players.find((p) => p.id === 'me')!.char;
    cs[1].c.leave(); // u1 joined before u2, so the old rule (first to join keeps it) would favour u1
    await w.run(300);
    const tile = cs[0].V().lobby.chars[x];
    expect([tile.locked, tile.tag]).toEqual([false, '']);
    cs[2].c.pickChar(x);
    await w.run(300);
    cs[1].c.setState({ codeInput: code });
    await cs[1].c.joinRoom();
    await w.run(1000);
    const ps = cs[0].S().players;
    expect(ps.find((p) => p.uid === 'u2')!.char).toBe(x);
    expect(ps.find((p) => p.uid === 'u1')!.char).not.toBe(x);
    expect(new Set(ps.map((p) => p.char)).size).toBe(3);
  });

  it('F5 a new room never inherits scraps of an old room with the same code', async () => {
    const w = new World();
    w.core.apply([{ path: 'rooms/AAAA/players/ghost', val: { name: 'Ghost', online: false, char: 3 } }]);
    const h = client(w, 'u0');
    await w.run(50);
    h.c.setState({ name: 'Sam' });
    vi.spyOn(Math, 'random').mockReturnValue(0); // the first code tried is AAAA
    await h.c.create();
    vi.restoreAllMocks();
    await w.run(200);
    expect(h.c.code).toBe('AAAA');
    expect(Object.keys((w.core.get('rooms/AAAA/players') as object) || {})).toEqual(['u0']);
    expect(h.S().players.map((p) => p.name)).toEqual(['Sam']);
  });

  it('F6 votes are locked once sent, and still show after a refresh', async () => {
    const { w, cs } = await toVote(3);
    const k = cs[0];
    k.c.chooseVote('best', 'u1');
    k.c.chooseVote('unh', 'u2');
    k.c.submitVotes();
    await w.run(200);
    k.c.chooseVote('best', 'u2'); // after sending: ignored
    expect(k.c.state.votes).toEqual({ best: 'u1', unh: 'u2' });
    const v = k.V().vote;
    expect(v.cards.find((c) => c.id === 'u1')!.isBest).toBe(true);
    expect(v.cards.find((c) => c.id === 'u2')!.isBest).toBe(false);
    expect(v.cards.every((c) => c.locked)).toBe(true);
    k.c.stop();
    const back = client(w, 'u0', k.store);
    await w.run(600);
    expect(back.S().screen).toBe('vote');
    const bv = back.V().vote;
    expect([bv.cards.find((c) => c.id === 'u1')!.isBest, bv.cards.find((c) => c.id === 'u2')!.isUnh, bv.hasVoted]).toEqual([true, true, true]);
  });

  it('F7 someone with nothing to vote on does not hold up the results', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(2);
    expect(await playTheme(w, cs, f, 'solo'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'solo'), f.join('\n')).toBe(true);
    cs[1].c.leave(); // leaves before locking in: only u0's pick will be shown
    await w.run(300);
    const k = cs[0];
    k.c.setImg('https://img.test/u0.png');
    k.c.updMine({ label: 'Mine' });
    await w.run(300);
    k.c.lockIn();
    await w.run(200);
    k.c.setRevealOk(true);
    expect(await w.until(() => k.S().screen === 'reveal' && !k.S().curtain, 12000)).toBe(true);
    for (let g = 0; g < 80 && k.S().screen !== 'results'; g++) {
      if (k.S().screen === 'reveal') {
        if ((k.S().part || 0) < k.c.partsOf('me').length) k.c.presentNext();
        else k.c.nextReveal();
      }
      await w.run(100);
    }
    expect(k.S().screen).toBe('results');
    expect(k.V().results.winners).toEqual([]);
    expect(k.V().results.noWinners).toMatch(/^No votes this round/);
  });

  it('F8 mid-game, a host whose screen stops answering hands over; in the lobby they stay host', async () => {
    const f: string[] = [];
    const { w, cs, code } = await setup(3);
    freeze(w, cs[0]); // in the lobby: e.g. away sending the code to friends
    await w.run(30000);
    expect([cs[1].S().hostName, cs[1].S().isHost, meta(w, code).host]).toEqual(['P0', false, 'u0']);
    wake(cs[0]);
    await w.run(500);
    expect(await playTheme(w, cs, f, 'hb'), f.join('\n')).toBe(true);
    cs[0].c.setDecoReady(true); // the host finishes decorating, then locks their phone
    await w.run(200);
    freeze(w, cs[0]);
    cs[1].c.setDecoReady(true);
    cs[2].c.setDecoReady(true);
    expect(await w.until(() => cs[1].S().screen === 'submit' && cs[2].S().screen === 'submit', 20000)).toBe(true);
    expect(meta(w, code).host).toBe('u1');
    wake(cs[0]); // the old host comes back and doesn't grab the role back
    await w.run(3000);
    expect([meta(w, code).host, cs[0].S().isHost, cs[1].S().isHost]).toEqual(['u1', false, true]);
  });

  it('F9 if two players act as host at the same moment, the room still moves on exactly once', async () => {
    const { w, cs } = await toVote(3);
    const writes: unknown[] = [];
    const apply = w.core.apply.bind(w.core);
    w.core.apply = (ops) => {
      for (const o of ops)
        if (/\/meta\/results$/.test(o.path) || (/\/meta$/.test(o.path) && (o.val as { results?: unknown } | null)?.results)) writes.push(o.val);
      apply(ops);
    };
    cs.forEach((k, i) => {
      k.c.chooseVote('best', 'u' + ((i + 1) % 3));
      k.c.chooseVote('unh', 'u' + ((i + 1) % 3));
      k.c.submitVotes();
    });
    const tally = (k: Client) => (k.c as unknown as { tallyVotes(): void }).tallyVotes();
    tally(cs[0]);
    tally(cs[1]);
    await w.until(() => cs.every((k) => k.S().screen === 'results'), 5000);
    await w.run(1000);
    expect(writes.length).toBe(1);
  });

  it('F10 two people in one room cannot have the same nickname', async () => {
    const { w, cs, code } = await setup(2); // P0 and P1
    const dup = client(w, 'u9');
    await w.run(50);
    dup.c.setState({ name: '  p0 ', codeInput: code });
    await dup.c.joinRoom();
    await w.run(100);
    expect([dup.S().screen, dup.c.state.err]).toEqual(['join', 'Someone in this room is already called p0. Try another nickname.']);
    dup.c.setState({ name: 'P9' });
    await dup.c.joinRoom();
    await w.run(200);
    expect(dup.S().screen).toBe('lobby');
    // Coming back to your own seat with your own name is fine, and a name only someone who left had is free.
    cs[1].c.leave();
    await w.run(200);
    const late = client(w, 'u8');
    await w.run(50);
    late.c.setState({ name: 'P1', codeInput: code });
    await late.c.joinRoom();
    await w.run(200);
    expect(late.S().screen).toBe('lobby');
    expect(sameName('Ann  Lee', ' ann lee')).toBe(true);
    expect(sameName('Ann', 'Anne')).toBe(false);
  });

  it('F11 a typed or pasted room code is cleaned up to its 4 letters', () => {
    expect(normCode('abcd')).toBe('ABCD');
    expect(normCode('Room LBXF')).toBe('LBXF');
    expect(normCode('Join my game: qwer!')).toBe('QWER');
    expect(normCode('https://ricardor2008.github.io/Hear-me-out-game/?room=QWER')).toBe('QWER');
    expect(normCode('lb')).toBe('LB');
    expect(normCode('abcde')).toBe('ABCD');
    expect(normCode('')).toBe('');
  });

  it('F12 leaving keeps the room code in the box, so getting back is one tap', async () => {
    const { w, cs, code } = await setup(2);
    // The room's creator never typed the code, so it can only be in the box if leaving put it there.
    expect(cs[0].c.state.codeInput).toBe('');
    cs[0].c.leave();
    await w.run(100);
    expect(cs[0].c.state.codeInput).toBe(code);
    await cs[0].c.joinRoom();
    await w.run(200);
    expect(cs[0].S().screen).toBe('lobby');
    // When the room itself is gone, its dead code isn't put in the box.
    cs[0].c.setState({ codeInput: '' });
    w.core.apply([{ path: 'rooms/' + code, val: null }]);
    await w.run(200);
    expect([cs[0].S().screen, cs[0].c.state.codeInput, cs[0].c.state.err]).toEqual(['join', '', 'That room closed.']);
  });

  it('F13 Undo lock-in does nothing once the curtains start closing', async () => {
    const f: string[] = [];
    const { w, cs, code } = await setup(2);
    expect(await playTheme(w, cs, f, 'c'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'c'), f.join('\n')).toBe(true);
    for (const k of cs) {
      k.c.setImg('https://img.test/' + k.uid + '.png');
      k.c.updMine({ label: 'L' + k.uid });
    }
    await w.run(400);
    for (const k of cs) k.c.lockIn();
    await w.run(300);
    for (const k of cs) k.c.setRevealOk(true);
    expect(await w.until(() => !!cs[0].S().curtain, 5000, 20)).toBe(true);
    cs[0].c.unlock();
    await w.run(50);
    expect(w.core.get('rooms/' + code + '/ready/u0')).toBe(true);
  });

  it('F14 only the host can change how the theme is chosen', async () => {
    const { w, cs, code } = await setup(2);
    expect(cs[1].V().lobby.themeModeOpts.map((o) => o.disabled)).toEqual([true, true]);
    expect(cs[0].V().lobby.themeModeOpts.map((o) => o.disabled)).toEqual([false, false]);
    cs[1].V().lobby.themeModeOpts[1].onClick();
    await w.run(100);
    expect(meta(w, code).themeMode).toBe('vote');
  });

  it('F15 if a room cannot be read, you get a message instead of waiting forever', async () => {
    const { w, code } = await setup(1);
    const k = client(w, 'u5');
    await w.run(50);
    k.net.watch = (_p, _cb, onError) => {
      w.setT(() => onError?.(new Error('permission_denied')), 10);
      return () => {};
    };
    k.c.setState({ name: 'Kim', codeInput: code });
    await k.c.joinRoom();
    await w.run(200);
    expect([k.S().screen, k.c.state.err]).toEqual(['join', 'Could not open that room (permission_denied).']);
  });

  it('F16 a file that is not a picture says so, and keeps the picture you already had', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(2);
    expect(await playTheme(w, cs, f, 'file'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'file'), f.join('\n')).toBe(true);
    const k = cs[0];
    k.c.setImg('https://img.test/a.png');
    await w.run(50);
    k.c.readFile({ type: 'text/plain', name: 'notes.txt' } as unknown as File);
    const v = k.V().submit;
    expect([v.fileErr, v.hasMyImg, v.cantLock]).toEqual([true, true, false]);
    k.c.setImg('https://img.test/b.png');
    expect(k.V().submit.fileErr).toBe(false);
  });

  it('F17 the cake credits the people who played, not someone who left before taking part', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(4);
    cs[3].c.leave(); // leaves in the lobby, never plays
    await w.run(300);
    const p3 = cs.slice(0, 3);
    expect(await playTheme(w, p3, f, 'cr'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, p3, f, 'cr'), f.join('\n')).toBe(true);
    expect(await playPick(w, p3, f, 'cr'), f.join('\n')).toBe(true);
    expect(await playReveal(w, p3, f, 'cr'), f.join('\n')).toBe(true);
    cs[2].c.leave(); // leaves after their pick was shown: still credited
    await w.run(300);
    for (const k of cs.slice(0, 2)) {
      const vc = k.V().vote.cards;
      vc[0].onBest();
      vc[vc.length - 1].onUnh();
      k.c.submitVotes();
    }
    expect(await w.until(() => cs[0].S().screen === 'results', 5000)).toBe(true);
    expect(cs[0].V().cake.credits).toBe('Decorated by P0, P1 and P2');
  });

  it('F18 the cake recipe line says "1 topping" and "1 drawing", and the keepsake says the same as the plaque', async () => {
    expect(recipeLine({ sponge: 'chocolate', frosting: 'pink', plate: 'gold' }, 1, 1)).toBe('Chocolate sponge · Pink frosting · Gold board · 1 topping · 1 drawing');
    expect(recipeLine({ sponge: 'vanilla', frosting: 'cream', plate: 'plate' }, 16, 0)).toBe('Vanilla sponge · Cream frosting · White plate · 16 toppings');
    const { w, cs } = await toVote(3);
    cs.forEach((k, i) => {
      k.c.chooseVote('best', 'u' + ((i + 1) % 3));
      k.c.chooseVote('unh', 'u' + ((i + 2) % 3));
      k.c.submitVotes();
    });
    await w.until(() => cs.every((k) => k.S().screen === 'results'), 5000);
    const s = cs[0].S();
    const stage = { cloneNode: () => ({ querySelectorAll: () => [], style: {}, outerHTML: '<div>cake</div>' }) } as unknown as HTMLElement;
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline in tests')));
    const { html } = await buildKeepsake(s, stage);
    expect(html).toContain(cs[0].V().cake.recipe);
    expect(html).not.toContain('frosting drawings');
    expect(html).toContain('Tie broken at random');
  });

  it('F19 "Connection lost" shows while the connection is down, but not while first connecting', async () => {
    const w = new World();
    const net = memoryNet(w.core, { uid: 'u0', defer: (f) => void w.setT(f, 0), now: () => w.now });
    net.setConnected!(false); // still connecting when the page opens
    const env: GameEnv = { createNet: () => Promise.resolve(net), storage: null, setTimeout: w.setT, clearTimeout: w.clrT, probeImage: () => {} };
    const c = new GameController(env);
    c.start();
    await w.run(100);
    await w.run(100); // the first "not connected" report reaches the game one tick after it subscribes
    expect(c.state.offline).toBe(false);
    const first = buildViewModel(c).banners.offline;
    net.setConnected!(true);
    await w.run(10);
    const up = buildViewModel(c).banners.offline;
    net.setConnected!(false);
    await w.run(10);
    const lost = buildViewModel(c).banners.offline;
    net.setConnected!(true);
    await w.run(10);
    expect([first, up, lost, buildViewModel(c).banners.offline]).toEqual(['', '', 'Connection lost. Trying to reconnect…', '']);
  });

  it('F20 an invite link fills in the code, and beats going back to an old room', async () => {
    const { w, code } = await setup(2);
    const h2 = client(w, 'h2');
    await w.run(50);
    h2.c.setState({ name: 'Host2' });
    await h2.c.create();
    await w.run(200);
    const other = h2.c.code;
    const z = client(w, 'u9');
    await w.run(50);
    z.c.setState({ name: 'Zed', codeInput: code });
    await z.c.joinRoom();
    await w.run(200);
    z.c.stop(); // closes the page while in the first room
    const toOther = player(w, 'u9', { store: { ...z.store }, invite: 'https://x.test/Hear-me-out-game/?room=' + other.toLowerCase() });
    await w.run(600);
    expect([toOther.S().screen, toOther.c.state.codeInput]).toEqual(['join', other]);
    toOther.c.stop();
    const toSame = player(w, 'u9', { store: { ...z.store }, invite: code });
    await w.run(600);
    expect([toSame.S().screen, toSame.c.code]).toEqual(['lobby', code]);
  });

  it('F21 a newer published version is noticed from a fresh copy of the page', () => {
    const page = (js: string) => '<!doctype html><script type="module" crossorigin src="./assets/' + js + '"></script>';
    expect(buildOf(page('index-D1QrpTaG.js'))).toBe('index-D1QrpTaG.js');
    expect(isNewerBuild(page('index-Zz9_x-1Q.js'), 'index-D1QrpTaG.js')).toBe(true);
    expect(isNewerBuild(page('index-D1QrpTaG.js'), 'index-D1QrpTaG.js')).toBe(false);
    expect(isNewerBuild('<html>Site not found</html>', 'index-D1QrpTaG.js')).toBe(false);
    expect(isNewerBuild(page('index-Zz9_x-1Q.js'), '')).toBe(false);
  });

  it('F22 Enter in the nickname box joins when a whole code is typed in, and makes a room otherwise', async () => {
    const { w, code } = await setup(1);
    const a = client(w, 'a1');
    await w.run(50);
    a.c.setState({ name: 'Ann' });
    a.V().join.enterName();
    await w.run(300);
    const b = client(w, 'b1');
    await w.run(50);
    b.c.setState({ name: 'Ben', codeInput: code });
    b.V().join.enterName();
    await w.run(300);
    expect([a.S().screen, a.c.code !== code, b.S().screen, b.c.code]).toEqual(['lobby', true, 'lobby', code]);
  });

  it('F23 the host heartbeat is light: about one write every 2 s from the host, none from anyone else', async () => {
    const { w, cs } = await setup(3);
    const count: Record<string, number> = { u0: 0, u1: 0, u2: 0 };
    for (const k of cs) {
      const up = k.net.update.bind(k.net);
      k.net.update = (p, o) => {
        if (Object.keys(o || {}).includes('meta/hb')) count[k.uid]++;
        return up(p, o);
      };
    }
    await w.run(60000);
    expect(count.u0).toBeGreaterThanOrEqual(28);
    expect(count.u0).toBeLessThanOrEqual(31);
    expect([count.u1, count.u2]).toEqual([0, 0]);
  });

  it('F24 while others vote, nobody waits for (or lists) a player whose own pick was the only one shown', async () => {
    const f: string[] = [];
    const { w, cs, code } = await setup(3);
    expect(await playTheme(w, cs, f, 'w'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'w'), f.join('\n')).toBe(true);
    cs[1].c.leave(); // u1 and u2 step away before locking in, so only u0's pick is revealed
    cs[2].c.leave();
    await w.run(300);
    const k = cs[0];
    k.c.setImg('https://img.test/u0.png');
    k.c.updMine({ label: 'Mine' });
    await w.run(300);
    k.c.lockIn();
    await w.run(200);
    k.c.setRevealOk(true);
    expect(await w.until(() => k.S().screen === 'reveal' && !k.S().curtain, 12000)).toBe(true);
    for (const back of [cs[1], cs[2]]) {
      back.c.setState({ codeInput: code }); // they come back during the reveal, so they can vote for u0's pick
      await back.c.joinRoom();
      await w.run(300);
    }
    for (let g = 0; g < 60 && k.S().screen === 'reveal'; g++) {
      if ((k.S().part || 0) < k.c.partsOf('me').length) k.c.presentNext();
      else k.c.nextReveal();
      await w.run(100);
    }
    expect(k.S().screen).toBe('vote');
    expect([k.V().vote.nothingToVote, k.V().vote.nothingText]).toEqual([true, 'The only pick shown was yours, so there is nothing for you to vote on. The results are on the way…']);
    cs[1].c.chooseVote('best', 'u0');
    cs[1].c.chooseVote('unh', 'u0');
    cs[1].c.submitVotes();
    await w.run(300);
    expect([cs[1].S().screen, cs[1].V().vote.waitText]).toEqual(['vote', 'Votes in. Waiting for P2…']);
    cs[2].c.chooseVote('best', 'u0');
    cs[2].c.chooseVote('unh', 'u0');
    cs[2].c.submitVotes();
    expect(await w.until(() => cs.every((x) => x.S().screen === 'results'), 5000)).toBe(true);
    expect(meta(w, code).results!.best).toEqual(['u0', 2]);
  });

  it('F25 when signing in fails, the message says what is really wrong', async () => {
    const tooMany = 'Too many new players from this network right now. Wait a few minutes, then refresh the page.';
    expect(signInTrouble({ code: 'auth/too-many-requests' })).toBe(tooMany);
    expect(signInTrouble(new Error('TOO_MANY_ATTEMPTS_TRY_LATER'))).toBe(tooMany);
    expect(signInTrouble({ code: 'auth/network-request-failed' })).toBe('Could not reach the game. Check your internet, then refresh the page.');
    expect(signInTrouble({ code: 'auth/admin-restricted-operation' })).toBe('Could not sign in. Turn on Anonymous sign-in in Firebase.');
    expect(signInTrouble(new Error('boom'))).toBe('Could not sign in (boom). Refresh the page to try again.');
    // And the game shows it: Firebase refuses the sign-in, as it does after too many new players from one network.
    const w = new World();
    const net = memoryNet(w.core, { uid: 'u0', defer: (f) => void w.setT(f, 0), now: () => w.now });
    const refused = Object.assign(new Error('Firebase: Error (auth/too-many-requests).'), { code: 'auth/too-many-requests' });
    const env: GameEnv = {
      createNet: () => Promise.resolve({ ...net, ready: () => Promise.reject(refused) }),
      storage: null,
      setTimeout: w.setT,
      clearTimeout: w.clrT,
      probeImage: () => {},
    };
    const c = new GameController(env);
    c.start();
    await w.run(100);
    expect(c.state.err).toBe(tooMany);
    c.setState({ name: 'Sam', err: '' });
    await c.create();
    expect([c.state.err, c.state.busy, c.view().screen]).toEqual([tooMany, false, 'join']);
  });
});
