// Whole games with several players, ported from the design's net-harness checks (N1–N11).
import { describe, expect, it, vi } from 'vitest';
import type { Room } from '../src/game/types';
import { World, allSee, client, playDecorate, playPick, playReveal, playTheme, playVote, polyOverlap, rectPoly, setup } from './world';

describe('multiplayer', () => {
  it.each([2, 3, 6, 12])('N1 a full game with %i players stays in sync', async (n) => {
    const f: string[] = [];
    const { w, cs } = await setup(n);
    const tag = 'n=' + n;
    const pc = cs.map((k) => k.S().players.length);
    if (pc.some((x) => x !== n)) f.push(tag + ': player counts ' + pc.join(','));
    const hosts = cs.filter((k) => k.S().isHost).map((k) => k.uid);
    if (hosts.length !== 1 || hosts[0] !== 'u0') f.push(tag + ': hosts ' + hosts.join(','));
    const chars = cs[0].S().players.map((p) => p.char);
    if (new Set(chars).size !== n) f.push(tag + ': duplicate characters ' + chars.join(','));
    const cols = cs[0].S().players.map((p) => p.color);
    if (new Set(cols).size !== n) f.push(tag + ': duplicate colors');

    expect(await playTheme(w, cs, f, tag), f.join('\n')).toBe(true);
    const th = cs.map((k) => k.S().cakeTheme);
    if (new Set(th).size !== 1 || !th[0]) f.push(tag + ': themes differ ' + th.join('|'));

    expect(await playDecorate(w, cs, f, tag), f.join('\n')).toBe(true);
    const tops = cs.map((k) => k.S().toppings.length);
    if (tops.some((x) => x !== n)) f.push(tag + ': toppings seen ' + tops.join(','));
    const sp = cs.map((k) => k.S().cake.sponge);
    if (sp.some((x) => x !== 'chocolate')) f.push(tag + ': sponge ' + sp.join(','));

    expect(await playPick(w, cs, f, tag), f.join('\n')).toBe(true);
    const ord = cs.map((k) =>
      k
        .S()
        .order.map((id) => (id === 'me' ? k.uid : id))
        .join(),
    );
    if (new Set(ord).size !== 1) f.push(tag + ': reveal order differs');
    if (cs[0].S().order.length !== n) f.push(tag + ': order length ' + cs[0].S().order.length);

    expect(await playReveal(w, cs, f, tag), f.join('\n')).toBe(true);
    expect(await playVote(w, cs, f, tag), f.join('\n')).toBe(true);
    const res = cs.map((k) => {
      const r = k.S().results;
      return r && [r.best && (r.best[0] === 'me' ? k.uid : r.best[0]), r.best && r.best[1]].join(':');
    });
    if (new Set(res).size !== 1) f.push(tag + ': results differ ' + res.join('|'));
    const items = cs[0].V().cake.items;
    if (items.length !== n) f.push(tag + ': results cake has ' + items.length + ' picks');
    const P = items.map(rectPoly);
    let ov = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (polyOverlap(P[i], P[j])) ov++;
    if (ov) f.push(tag + ': ' + ov + ' overlapping picks on the final cake');
    if (w.errors.length) f.push(tag + ': errors ' + w.errors.slice(0, 2).join(' || '));
    expect(f).toEqual([]);
  });

  it('N2 the next player takes over as host when the host leaves', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(4);
    expect(await playTheme(w, cs, f, 'host-leave'), f.join('\n')).toBe(true);
    cs[0].net.disconnect();
    await w.run(600);
    const hosts = cs
      .slice(1)
      .filter((k) => k.S().isHost)
      .map((k) => k.uid);
    if (hosts.join() !== 'u1') f.push('new host ' + JSON.stringify(hosts) + ' (want u1)');
    const meta = w.core.get('rooms/' + cs[1].c.code + '/meta') as Room['meta'];
    if (meta?.host !== 'u1') f.push('meta.host ' + meta?.host);
    const rest = cs.slice(1);
    expect(await playDecorate(w, rest, f, 'after host left', []), f.join('\n')).toBe(true);
    if (!rest.every((k) => k.S().screen === 'submit')) f.push('game stalled without old host');
    expect(f).toEqual([]);
  });

  it('N3 refreshing puts you back in your seat', async () => {
    const f: string[] = [];
    const { w, cs, code } = await setup(3);
    expect(await playTheme(w, cs, f, 'rejoin'), f.join('\n')).toBe(true);
    const old = cs[1];
    old.net.disconnect();
    old.c.stop();
    await w.run(300);
    if (cs[0].S().players.find((p) => p.uid === 'u1')!.online) f.push('left player still shows online');
    const back = client(w, 'u1', old.store);
    await w.run(600);
    if (back.S().screen !== 'decorate') f.push('after refresh screen=' + back.S().screen + ' (want decorate)');
    if (back.S().code !== code) f.push('rejoined room ' + back.S().code);
    if (!cs[0].S().players.find((p) => p.uid === 'u1')!.online) f.push('rejoined player still away');
    if (cs[0].S().players.length !== 3) f.push('seat count ' + cs[0].S().players.length);
    expect(f).toEqual([]);
  });

  it('N4 late joiners, bad codes, full rooms and non-hosts are turned away', async () => {
    const f: string[] = [];
    const { w, cs, code } = await setup(2);
    const late = client(w, 'late');
    await w.run(50);
    late.c.setState({ name: 'Late', codeInput: code });
    cs[0].c.startGame();
    await w.run(200);
    await late.c.joinRoom();
    await w.run(100);
    if (late.S().screen !== 'join' || !/already started/.test(late.c.state.err)) f.push('late joiner got in: ' + late.S().screen + ' "' + late.c.state.err + '"');
    const bad = client(w, 'bad');
    await w.run(50);
    bad.c.setState({ name: 'X', codeInput: 'ZZZZ' });
    await bad.c.joinRoom();
    if (!/No room/.test(bad.c.state.err)) f.push('bad code msg "' + bad.c.state.err + '"');

    const { w: w2, code: c2 } = await setup(12);
    const extra = client(w2, 'x13');
    await w2.run(50);
    extra.c.setState({ name: 'Thirteen', codeInput: c2 });
    await extra.c.joinRoom();
    if (!/full/.test(extra.c.state.err)) f.push('13th player msg "' + extra.c.state.err + '"');

    const { w: w3, cs: c3 } = await setup(2);
    c3[1].c.startGame();
    await w3.run(200);
    if (c3[1].S().screen !== 'lobby') f.push('non-host could start');
    expect(f).toEqual([]);
  });

  it('N5 picking starts 3 seconds after everyone finishes decorating', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(3);
    expect(await playTheme(w, cs, f, 'cd'), f.join('\n')).toBe(true);
    cs.forEach((k) => k.c.setDecoReady(true));
    await w.run(300);
    const g = cs.map((k) => k.V().decorate.waitText);
    if (new Set(g).size !== 1 || !/starts in/.test(g[0])) f.push('countdown text differs ' + g.join('|'));
    cs[2].c.setDecoReady(false);
    await w.run(4000);
    if (cs.some((k) => k.S().screen !== 'decorate')) f.push('picking started after someone un-readied');
    cs[2].c.setDecoReady(true);
    await w.run(1500);
    if (cs.some((k) => k.S().screen !== 'decorate')) f.push('picking started before the 3s countdown');
    await w.run(2500);
    if (cs.some((k) => k.S().screen !== 'submit')) f.push('picking did not start after countdown');
    expect(f).toEqual([]);
  });

  it('N6 everyone sees where picks are going, and overlaps slide apart', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(3);
    await playTheme(w, cs, f, 'live');
    await playDecorate(w, cs, f, 'live');
    const a = cs[0],
      b = cs[1];
    a.c.setImg('https://img.test/a.png');
    await w.run(200);
    a.c.dragging = true;
    a.c.updMine({ x: 40, y: 56 });
    await w.run(300);
    const seen = b.V().cake.ghosts.find((g) => g.id === 'u0');
    if (!seen) f.push('other player does not see my spot');
    else if (Math.abs(parseFloat(seen.left) - 40) > 0.01) f.push('ghost at ' + seen.left + ' not 40%');
    const bp = b.S().picks.me;
    a.c.updMine({ x: bp.x, y: bp.y, stick: bp.stick });
    await w.run(300);
    const clash = a.c.mineClashes();
    if (!clash.includes('u1')) f.push('overlap not detected ' + JSON.stringify(clash));
    if (!/Too close to P1/.test(a.V().cake.caption)) f.push('caption "' + a.V().cake.caption + '"');
    a.up();
    await w.run(400);
    const after = a.c.mineClashes();
    if (after.length) f.push('still overlapping after release ' + after.join());
    const mineDb = w.core.get('rooms/' + a.c.code + '/picks/u0') as { moving?: boolean; x: number };
    if (mineDb.moving) f.push('still marked moving after release');
    if (Math.abs(mineDb.x - a.S().picks.me.x) > 0.01) f.push('db position not synced');
    expect(f).toEqual([]);
  });

  it('N7 only the presenter reveals, reactions count, and the host covers for a leaver', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(3);
    await playTheme(w, cs, f, 'pres');
    await playDecorate(w, cs, f, 'pres');
    await playPick(w, cs, f, 'pres');
    const pres = cs.find((k) => k.S().order[k.S().idx] === 'me')!,
      other = cs.find((k) => k !== pres)!;
    other.c.presentNext();
    await w.run(200);
    if ((other.S().part || 0) !== 0) f.push('non-presenter advanced the build');
    other.c.react('laugh');
    await w.run(100);
    const r0 = JSON.stringify(w.core.get('rooms/' + pres.c.code + '/reacts') || {});
    if (r0 !== '{}') f.push('reaction counted before picture: ' + r0);
    pres.c.presentNext();
    await w.run(200);
    if (cs.some((k) => (k.S().part || 0) !== 1)) f.push('part not 1 everywhere');
    other.c.react('laugh');
    other.c.react('laugh');
    cs[cs.indexOf(other) === 2 ? 1 : 2].c.react('boo');
    await w.run(200);
    const rr = pres.S().reacts.me || {};
    if (rr.laugh !== 2 || rr.boo !== 1) f.push('reaction totals ' + JSON.stringify(rr));
    const fl = pres.c.state.floaters.length;
    if (fl !== 3) f.push('presenter saw ' + fl + ' floating emoji (want 3)');
    other.c.nextReveal();
    await w.run(200);
    if (other.S().idx !== 0) f.push('non-presenter skipped');
    pres.net.disconnect();
    await w.run(9000);
    const host = cs.find((k) => k !== pres && k.S().isHost)!;
    const tot = host.c.partsOf(host.S().order[host.S().idx]).length;
    if (host.S().idx === 0 && (host.S().part || 0) < tot) f.push('host did not finish presenting for the player who left (part ' + host.S().part + '/' + tot + ')');
    expect(f).toEqual([]);
  });

  it('N8 the final cake is stamped and Bake another starts a clean round', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(2);
    await playTheme(w, cs, f, 'again');
    await playDecorate(w, cs, f, 'again');
    await playPick(w, cs, f, 'again');
    await playReveal(w, cs, f, 'again');
    await playVote(w, cs, f, 'again');
    const stamp = cs.map((k) => k.V().cake.stamp);
    if (new Set(stamp).size !== 1 || !/HRS$/.test(stamp[0])) f.push('stamps ' + stamp.join('|'));
    cs[1].c.playAgain();
    await w.run(300);
    if (!allSee(cs, 'lobby')) f.push('not back in lobby');
    const room = w.core.get('rooms/' + cs[0].c.code) as Record<string, unknown>;
    const left = ['picks', 'toppings', 'votes', 'reacts', 'ready'].filter((k) => room[k]);
    if (left.length) f.push('leftover data ' + left.join());
    expect(await playTheme(w, cs, f, 'round 2'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 'round 2'), f.join('\n')).toBe(true);
    if (cs[0].S().toppings.length !== 2) f.push('round 2 toppings ' + cs[0].S().toppings.length);
    expect(f).toEqual([]);
  });

  it('N9 rooms older than 24 hours are pruned', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(2);
    w.core.apply([
      { path: 'rooms/OLDX/meta', val: { createdAt: w.now - 25 * 3600 * 1000, phase: 'lobby' } },
      { path: 'rooms/NEWX/meta', val: { createdAt: w.now - 3600 * 1000, phase: 'lobby' } },
    ]);
    await cs[0].net.pruneRooms(24 * 3600 * 1000);
    const keys = Object.keys((w.core.get('rooms') as object) || {});
    if (keys.includes('OLDX')) f.push('24h-old room kept');
    if (!keys.includes('NEWX')) f.push('1h-old room deleted');
    if (!keys.includes(cs[0].c.code)) f.push('live room deleted');
    expect(f).toEqual([]);
  });

  it('N10 simultaneous joins never end with two players on one character or color', async () => {
    const f: string[] = [];
    const w = new World(),
      cs = Array.from({ length: 6 }, (_, i) => client(w, 'u' + i));
    await w.run(50);
    cs[0].c.setState({ name: 'P0' });
    await cs[0].c.create();
    await w.run(50);
    const code = cs[0].c.code;
    // Everyone joins at once and (with random pinned) grabs the same free character.
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await Promise.all(
      cs.slice(1).map((k, i) => {
        k.c.setState({ name: 'P' + (i + 1), codeInput: code });
        return k.c.joinRoom();
      }),
    );
    rand.mockRestore();
    const raw = Object.values(w.core.get('rooms/' + code + '/players') as Record<string, { char: number }>);
    const dupBefore = raw.length - new Set(raw.map((p) => p.char)).size;
    await w.run(1000);
    const ps = cs[0].S().players;
    const dupC = ps.length - new Set(ps.map((p) => p.char)).size,
      dupK = ps.length - new Set(ps.map((p) => p.color)).size;
    if (ps.length !== 6) f.push('players ' + ps.length);
    if (dupC) f.push(dupC + ' duplicate characters after host fix');
    if (dupK) f.push(dupK + ' duplicate colors after host fix');
    const views = cs.map((k) =>
      k
        .S()
        .players.map((p) => p.char)
        .join(),
    );
    if (new Set(views).size !== 1) f.push('clients disagree on characters');
    if (!dupBefore) f.push('test did not create a collision (harness too weak)');
    expect(f).toEqual([]);
  });

  it('N11 results wait for every vote, but not for players who left', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(3);
    await playTheme(w, cs, f, 'v');
    await playDecorate(w, cs, f, 'v');
    await playPick(w, cs, f, 'v');
    await playReveal(w, cs, f, 'v');
    const vote = (k: (typeof cs)[number]) => {
      const vc = k.V().vote.cards;
      vc[0].onBest();
      vc[vc.length - 1].onUnh();
      k.c.submitVotes();
    };
    vote(cs[0]);
    await w.run(1500);
    if (cs.some((k) => k.S().screen !== 'vote')) f.push('results before everyone voted');
    if (!cs[0].V().vote.hasVoted || !/Waiting for/.test(cs[0].V().vote.waitText)) f.push('no waiting text: ' + cs[0].V().vote.waitText);
    vote(cs[1]);
    await w.run(1500);
    if (cs.some((k) => k.S().screen !== 'vote')) f.push('results with one vote missing');
    cs[2].net.disconnect();
    await w.run(1500);
    if (cs.slice(0, 2).some((k) => k.S().screen !== 'results')) f.push('stuck waiting for a player who left');
    const r = cs[0].S().results,
      votes = w.core.get('rooms/' + cs[0].c.code + '/votes') as Record<string, { best: string }>;
    const cnt: Record<string, number> = {};
    Object.values(votes).forEach((x) => (cnt[x.best] = (cnt[x.best] || 0) + 1));
    const top = Math.max(...Object.values(cnt));
    if (!r || !r.best || r.best[1] !== top) f.push('best award count ' + (r && r.best && r.best[1]) + ' vs tally ' + top);
    expect(f).toEqual([]);
  });

  it('N12 each award goes to the pick with the most votes', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(4);
    await playTheme(w, cs, f, 'tally');
    await playDecorate(w, cs, f, 'tally');
    await playPick(w, cs, f, 'tally');
    await playReveal(w, cs, f, 'tally');
    // u1 gets three Best votes (u0, u2, u3) and u0 gets one (from u1); Most unhinged mirrors it.
    for (const k of cs) {
      const best = k.uid === 'u1' ? 'u0' : 'u1',
        unh = k.uid === 'u2' ? 'u3' : 'u2';
      k.c.chooseVote('best', best);
      k.c.chooseVote('unh', unh);
      k.c.submitVotes();
    }
    expect(await w.until(() => allSee(cs, 'results'), 5000)).toBe(true);
    for (const k of cs) {
      const r = k.S().results!;
      const id = (x: string) => (x === 'me' ? k.uid : x);
      if (id(r.best![0]) !== 'u1' || r.best![1] !== 3) f.push(k.uid + ' sees best ' + JSON.stringify(r.best));
      if (id(r.unh![0]) !== 'u2' || r.unh![1] !== 3) f.push(k.uid + ' sees unhinged ' + JSON.stringify(r.unh));
    }
    const titles = cs[0].V().results.winners.map((x) => x.title + ':' + x.sub);
    if (titles.join('|') !== "Best pick:P1's pick · 3 votes|Most unhinged:P2's pick · 3 votes") f.push('winner cards ' + titles.join('|'));
    expect(f).toEqual([]);
  });
});
