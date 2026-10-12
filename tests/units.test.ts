import { describe, expect, it } from 'vitest';
import { freeSpotFor, layoutPicks, onTopOk, pickClash } from '../src/game/geometry';
import { asArr, capLines, cleanTheme, listJoin, milStamp, normTheme } from '../src/game/util';
import { Core, memoryNet, pushId } from '../src/net/core';

describe('text helpers', () => {
  it('reads Firebase-style arrays', () => {
    expect(asArr(['a', 'b'])).toEqual(['a', 'b']);
    expect(asArr({ 10: 'c', 2: 'b', 0: 'a' })).toEqual(['a', 'b', 'c']);
    expect(asArr(null)).toEqual([]);
  });
  it('stamps the finished cake with a 24-hour time', () => {
    expect(milStamp(new Date(2026, 9, 5, 21, 7).getTime())).toBe('05 OCT 2026 · 2107 HRS');
  });
  it('splits a defense into non-empty lines', () => {
    expect(capLines('  one \n\n two\r\nthree ')).toEqual(['one', 'two', 'three']);
    expect(capLines(undefined)).toEqual([]);
  });
  it('treats theme ideas that differ only in case and spacing as the same', () => {
    expect(cleanTheme('  Movie   monsters ')).toBe('Movie monsters');
    expect(normTheme('MOVIE  Monsters')).toBe(normTheme('movie monsters'));
    expect(cleanTheme('x'.repeat(60))).toHaveLength(40);
  });
  it('lists names in plain English', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['A'])).toBe('A');
    expect(listJoin(['A', 'B'])).toBe('A and B');
    expect(listJoin(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('in-memory database', () => {
  it('writes, reads and prunes empty parents like Firebase', () => {
    const core = new Core();
    core.apply([{ path: 'rooms/ABCD/players/u1', val: { name: 'Sam', online: true } }]);
    expect(core.get('rooms/ABCD/players/u1/name')).toBe('Sam');
    core.apply([{ path: 'rooms/ABCD/players/u1', val: null }]);
    expect(core.get('rooms')).toBeNull();
  });
  it('only notifies watchers of related paths', async () => {
    const core = new Core(),
      seen: string[] = [];
    const net = memoryNet(core, { defer: (f) => f() });
    net.watch('rooms/ABCD', () => seen.push('room'));
    net.watch('rooms/WXYZ', () => seen.push('other'));
    seen.length = 0;
    await net.set('rooms/ABCD/meta/phase', 'lobby');
    expect(seen).toEqual(['room']);
  });
  it('aborts a transaction when the update returns undefined', async () => {
    const net = memoryNet(new Core());
    await net.set('rooms/ABCD/meta', { phase: 'lobby' });
    const r = await net.tx('rooms/ABCD/meta', (cur) => (cur ? undefined : { phase: 'new' }));
    expect(r.committed).toBe(false);
    expect(await net.get('rooms/ABCD/meta/phase')).toBe('lobby');
  });
  it('makes time-ordered, unique push ids', () => {
    const a = pushId(1000),
      b = pushId(1000),
      c = pushId(2000);
    expect(a).not.toBe(b);
    expect([c, b, a].sort()).toEqual([a, b, c]);
  });
});

describe('cake layout', () => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('fits %i picks on the cake without overlaps', (n) => {
    const ids = Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));
    const lay = layoutPicks(ids);
    expect(lay).not.toBeNull();
    const slots = Object.values(lay!);
    expect(slots).toHaveLength(n);
    for (const s of slots) expect(onTopOk(s.x, s.y)).toBe(true);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(pickClash(slots[i], slots[j], n)).toBe(false);
  });
  it('slides an overlapping pick to a free spot', () => {
    const other = { x: 50, y: 58, stick: 9.5, scale: 1, rot: 0 };
    const mine = { ...other, x: 51 };
    expect(pickClash(mine, other, 2)).toBe(true);
    const q = freeSpotFor(mine, [other], 2);
    expect(pickClash(q, other, 2)).toBe(false);
    expect(onTopOk(q.x, q.y)).toBe(true);
  });
});
