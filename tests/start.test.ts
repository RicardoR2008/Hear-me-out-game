// The lobby start (S1–S10): everyone presses Start the cake, then the host presses "Let us take them to the bakery!",
// a 3-second countdown runs on every screen, and the game starts. Not yet takes your OK back, even during the countdown.
import { describe, expect, it } from 'vitest';
import { World, client, playDecorate, playPick, playReveal, playTheme, playVote, setup, startCake, type Client } from './world';

/** "Who is ready" as one viewer sees it, without their own "(you)". */
const statuses = (k: Client) => k.V().lobby.readyList.map((r) => r.name.replace(' (you)', '') + ': ' + r.status);
/** Names with a check mark in the header. */
const checks = (k: Client) => k.V().header.players.filter((p) => p.ready).map((p) => p.name);
const screens = (cs: Client[]) => cs.map((k) => k.S().screen);
const counts = (cs: Client[]) => cs.map((k) => k.S().startGo);
/** Stops a player's game loop (their screen keeps its last view of the room). */
const freeze = (w: World, k: Client) => w.clrT((k.c as unknown as { tickT: number }).tickT);

describe('start the cake', () => {
  it('S1 nobody goes to the bakery until everyone has pressed Start the cake; then a 3-second countdown starts the game', async () => {
    const { w, cs } = await setup(3);
    const host = cs[0];
    host.c.goToBakery(); // nobody is ready yet
    await w.run(3500);
    expect([screens(cs), counts(cs)]).toEqual([['lobby', 'lobby', 'lobby'], [null, null, null]]);
    host.c.setStartReady(true);
    cs[1].c.setStartReady(true);
    await w.run(200);
    expect([host.V().lobby.cantGo, host.V().lobby.goHint]).toEqual([true, 'Waiting for P2 to press Start the cake.']);
    host.c.goToBakery(); // P2 is not ready
    await w.run(3500);
    expect([screens(cs), counts(cs)]).toEqual([['lobby', 'lobby', 'lobby'], [null, null, null]]);
    cs[2].c.setStartReady(true);
    await w.run(200);
    expect([host.V().lobby.cantGo, host.V().lobby.goHint]).toEqual([false, '']);
    host.c.goToBakery();
    await w.run(150);
    expect([counts(cs), cs.map((k) => k.V().lobby.countdown)]).toEqual([
      [3, 3, 3],
      [3, 3, 3],
    ]);
    host.c.goToBakery(); // a second press does not restart the countdown
    await w.run(2500); // 2.65 s after the first press: still counting
    expect([screens(cs), counts(cs)]).toEqual([['lobby', 'lobby', 'lobby'], [1, 1, 1]]);
    await w.run(700);
    expect(screens(cs)).toEqual(['theme', 'theme', 'theme']);
  });

  it('S2 everyone, the host too, sees who has pressed Start the cake, in the list and as a check mark at the top', async () => {
    const { w, cs } = await setup(3);
    cs[1].c.setStartReady(true);
    await w.run(200);
    for (const k of cs) expect([statuses(k), checks(k)]).toEqual([['P0: Not ready', 'P1: Ready', 'P2: Not ready'], ['P1']]);
    cs[0].c.setStartReady(true); // the host presses it too
    await w.run(200);
    for (const k of cs) expect([statuses(k), checks(k)]).toEqual([['P0: Ready', 'P1: Ready', 'P2: Not ready'], ['P0', 'P1']]);
    expect([cs[1].V().lobby.meStarted, cs[1].V().lobby.startWait, cs[2].V().lobby.meStarted]).toEqual([true, 'You are ready. Waiting for P2.', false]);
    cs[2].c.setStartReady(true);
    await w.run(200);
    expect([cs[0].V().lobby.startWait, cs[1].V().lobby.startWait]).toEqual(['Everyone is ready. Take them to the bakery!', 'Everyone is ready. Waiting for P0 to take you to the bakery.']);
    // Only the host has the bakery button, and only the host's works.
    expect([cs.map((k) => k.V().lobby.isHost), cs.map((k) => k.V().lobby.cantGo)]).toEqual([
      [true, false, false],
      [false, true, true],
    ]);
  });

  it('S3 Not yet takes your OK back before the host presses', async () => {
    const { w, cs } = await setup(3);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    expect(cs[0].V().lobby.cantGo).toBe(false);
    cs[2].c.setStartReady(false);
    await w.run(200);
    expect([cs[0].V().lobby.cantGo, cs[0].V().lobby.goHint, cs[2].V().lobby.meStarted]).toEqual([true, 'Waiting for P2 to press Start the cake.', false]);
    for (const k of cs) expect(checks(k)).toEqual(['P0', 'P1']);
    cs[0].c.goToBakery();
    await w.run(3500);
    expect(screens(cs)).toEqual(['lobby', 'lobby', 'lobby']);
  });

  it('S4 Not yet during the countdown stops it on every screen, and the game waits for the host again', async () => {
    const { w, cs } = await setup(3);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(1500);
    expect(counts(cs)).toEqual([2, 2, 2]);
    cs[1].c.setStartReady(false); // the Not yet button in the countdown box
    await w.run(300);
    expect(counts(cs)).toEqual([null, null, null]);
    await w.run(5000);
    expect(screens(cs)).toEqual(['lobby', 'lobby', 'lobby']);
    cs[1].c.setStartReady(true);
    await w.run(300);
    expect(counts(cs)).toEqual([null, null, null]); // ready again, but only the host starts a countdown
    cs[0].c.goToBakery();
    await w.run(3400);
    expect(screens(cs)).toEqual(['theme', 'theme', 'theme']);
  });

  it("S4b Not yet stops the countdown at once, even when the host's screen is asleep", async () => {
    const { w, cs } = await setup(3);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(1000);
    freeze(w, cs[0]); // the host locks their phone during the countdown
    cs[2].c.setStartReady(false);
    await w.run(300);
    expect(counts(cs)).toEqual([null, null, null]);
  });

  it('S5 a player who comes in during the countdown stops it, because they have not pressed Start the cake', async () => {
    const { w, cs, code } = await setup(2);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(800);
    const late = client(w, 'u9');
    await w.run(50);
    late.c.setState({ name: 'Late', codeInput: code });
    await late.c.joinRoom();
    await w.run(400);
    expect([...counts(cs), late.S().startGo]).toEqual([null, null, null]);
    await w.run(4000);
    expect([...screens(cs), late.S().screen]).toEqual(['lobby', 'lobby', 'lobby']);
    expect(cs[0].V().lobby.goHint).toBe('Waiting for Late to press Start the cake.');
  });

  it('S6 a player who left does not hold the others up, and leaving takes their OK back', async () => {
    const { w, cs } = await setup(3);
    cs[2].c.setStartReady(true);
    await w.run(200);
    cs[2].c.leave();
    await w.run(600);
    expect([cs[0].S().startReady, statuses(cs[0])]).toEqual([{}, ['P0: Not ready', 'P1: Not ready', 'P2: Away']]);
    cs[0].c.setStartReady(true);
    cs[1].c.setStartReady(true);
    await w.run(200);
    expect(cs[0].V().lobby.cantGo).toBe(false);
    cs[0].c.goToBakery();
    await w.run(3400);
    expect(screens(cs.slice(0, 2))).toEqual(['theme', 'theme']);
  });

  it('S7 with a theme you already agreed on, the host types it first, and the countdown goes straight to decorating', async () => {
    const { w, cs } = await setup(2);
    cs[0].c.setThemeMode('agreed');
    await w.run(100);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    expect([cs[0].V().lobby.cantGo, cs[0].V().lobby.goHint, cs[1].V().lobby.startWait]).toEqual([
      true,
      'Type the theme you all agreed on first.',
      'Everyone is ready. Waiting for P0 to type the theme.',
    ]);
    cs[0].c.setThemeAgreed('Sea creatures');
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(3400);
    expect(cs.map((k) => [k.S().screen, k.S().cakeTheme])).toEqual([
      ['decorate', 'Sea creatures'],
      ['decorate', 'Sea creatures'],
    ]);
  });

  it('S8 Bake another starts the next round with nobody ready and no countdown', async () => {
    const f: string[] = [];
    const { w, cs } = await setup(2);
    expect(await playTheme(w, cs, f, 's8'), f.join('\n')).toBe(true);
    expect(await playDecorate(w, cs, f, 's8'), f.join('\n')).toBe(true);
    expect(await playPick(w, cs, f, 's8'), f.join('\n')).toBe(true);
    expect(await playReveal(w, cs, f, 's8'), f.join('\n')).toBe(true);
    expect(await playVote(w, cs, f, 's8'), f.join('\n')).toBe(true);
    cs[1].c.playAgain();
    await w.run(400);
    expect(screens(cs)).toEqual(['lobby', 'lobby']);
    for (const k of cs) expect([statuses(k), checks(k), k.S().startGo, k.V().lobby.meStarted]).toEqual([['P0: Not ready', 'P1: Not ready'], [], null, false]);
    await startCake(w, cs); // and the next round starts the same way
    expect(screens(cs)).toEqual(['theme', 'theme']);
  });

  it('S9 if the host leaves during the countdown, the next player takes over and the game still starts', async () => {
    const { w, cs } = await setup(3);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(1000);
    cs[0].c.leave();
    await w.run(3000);
    expect([cs[1].S().isHost, ...screens(cs.slice(1))]).toEqual([true, 'theme', 'theme']);
  });

  it('S10 if two players act as host when the countdown ends, the game starts exactly once and is cleared once', async () => {
    const { w, cs } = await setup(3);
    cs.forEach((k) => k.c.setStartReady(true));
    await w.run(200);
    cs[0].c.goToBakery();
    await w.run(200);
    cs.forEach((k) => freeze(w, k)); // nobody's game loop runs: both "hosts" are played by hand below
    const start = (k: Client) => (k.c as unknown as { startGame(): Promise<void> }).startGame();
    void start(cs[0]); // too early: the countdown is not over
    await w.run(300);
    expect(screens(cs)).toEqual(['lobby', 'lobby', 'lobby']);
    await w.run(2900);
    const starts: unknown[] = [],
      wipes: unknown[] = [];
    const apply = w.core.apply.bind(w.core);
    w.core.apply = (ops) => {
      for (const o of ops) {
        if (/\/meta$/.test(o.path) && (o.val as { phase?: string } | null)?.phase === 'theme') starts.push(o.val);
        if (/\/themeSugs$/.test(o.path)) wipes.push(o.val);
      }
      apply(ops);
    };
    (cs[1].c as unknown as { amHost(): boolean }).amHost = () => true; // P1 also believes it is the host
    void start(cs[0]);
    void start(cs[1]);
    await w.run(1000);
    expect([starts.length, wipes.length, ...screens(cs)]).toEqual([1, 1, 'theme', 'theme', 'theme']);
  });
});
