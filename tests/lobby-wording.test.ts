// Who is host is easy to see (R1, R2), and nothing a player reads uses contractions (W1).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { setup } from './world';

const A = "['’]";
/** Contractions: don't/can't…, you're/we'll/I've/you'd/I'm, and it's/who's/everyone's (meaning "is"). Not possessives like "Sam's". */
const CONTRACTION = new RegExp(
  `\\b[A-Za-z]+n${A}t\\b|\\b[A-Za-z]+${A}(?:re|ll|ve|d|m)\\b|\\b(?:it|that|there|here|what|who|where|when|how|he|she|let|everyone|everybody|someone|somebody|nobody|nothing|something|everything|this)${A}s\\b`,
  'gi',
);

/** Blanks out // and /* comments (they are for programmers, not players), keeping strings and line numbers. */
function stripComments(text: string) {
  let out = '',
    i = 0,
    quote: string | null = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (text.startsWith('/*', i)) {
      let j = text.indexOf('*/', i + 2);
      j = j < 0 ? text.length : j + 2;
      out += text.slice(i, j).replace(/[^\n]/g, ' ');
      i = j;
      continue;
    }
    if (text.startsWith('//', i) && (i === 0 || text[i - 1] !== ':')) {
      let j = text.indexOf('\n', i);
      j = j < 0 ? text.length : j;
      out += ' '.repeat(j - i);
      i = j;
      continue;
    }
    // An apostrophe right after a letter is a word's apostrophe (JSX text), not the start of a string.
    if (c === '"' || c === '`' || (c === "'" && !(i > 0 && /[A-Za-z]/.test(text[i - 1])))) quote = c;
    out += c;
    i++;
  }
  return out;
}

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

describe('lobby and wording', () => {
  it('R1 the lobby says at the top whether you are the host or a player', async () => {
    const { w, cs } = await setup(3);
    const h = cs[0].V().lobby,
      p = cs[1].V().lobby;
    expect([h.role.host, h.role.title, h.role.text, h.role.icon]).toEqual([true, 'You are the host', 'When everyone has pressed Start the cake, you take them to the bakery.', '👑']);
    expect([p.role.host, p.role.title, p.role.text]).toEqual([false, 'You are a player', 'P0 is the host. Press Start the cake when you are ready.']);
    expect([h.note, p.note]).toEqual(['3 of 12 players.', '3 of 12 players.']);
    // The host leaves: the next player's card now says they are the host.
    cs[0].c.leave();
    await w.run(600);
    expect(cs[1].V().lobby.role.title).toBe('You are the host');
    expect(cs[2].V().lobby.role.text).toBe('P1 is the host. Press Start the cake when you are ready.');
  });

  it('R2 the header puts a crown on the host, and only on the host, for everyone', async () => {
    const { w, cs } = await setup(3);
    for (const k of cs) expect(k.V().header.players.filter((x) => x.host).map((x) => x.name)).toEqual(['P0']);
    cs[0].c.leave();
    await w.run(600);
    for (const k of cs.slice(1)) expect(k.V().header.players.filter((x) => x.host).map((x) => x.name)).toEqual(['P1']);
  });

  it('W1 no contractions in anything a player reads', () => {
    // The pattern itself: catches contractions (straight or curly apostrophe), leaves possessives alone.
    const probe = (s: string) => [...s.matchAll(CONTRACTION)].map((m) => m[0]);
    expect(probe("You're the host. Sam's pick. Tonight's theme. Who's ready? I'm in. Can't stop. It’s fine. We'll go.")).toEqual([
      "You're",
      "Who's",
      "I'm",
      "Can't",
      'It’s',
      "We'll",
    ]);
    const files = [...walk('src').filter((f) => /\.(tsx?|css)$/.test(f)), 'index.html'];
    const hits: string[] = [];
    for (const f of files) {
      const raw = readFileSync(f, 'utf8');
      // \' inside a quoted string is still an apostrophe the player sees.
      const body = (/\.(tsx?|css)$/.test(f) ? stripComments(raw) : raw).replace(/\\'/g, "'");
      body.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(CONTRACTION)) hits.push(f + ':' + (i + 1) + ' ' + m[0]);
      });
    }
    expect(files.length).toBeGreaterThanOrEqual(33);
    expect(hits).toEqual([]);
  });
});
