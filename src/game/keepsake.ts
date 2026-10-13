import { REACTS } from './constants';
import type { View } from './controller';
import { recipeLine } from './util';

const esc = (t: unknown) =>
  String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const norm = (u: string) => String(u).replace(/[\n\r]/g, '').replace(/\\/g, '%5C').replace(/"/g, '%22');

/** Fetches a picture and inlines it so the keepsake still works offline. Falls back to the link. */
async function toDataUrl(u: string): Promise<string> {
  if (/^data:/.test(u)) return u;
  try {
    const b = await (await fetch(u)).blob();
    return await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result));
      fr.onerror = () => r(u);
      fr.readAsDataURL(b);
    });
  } catch {
    return u;
  }
}

/**
 * A standalone HTML page of the finished game: the decorated cake (copied from the screen),
 * the awards and everyone's picks with their defenses and reaction counts.
 * `stage` is the element that holds the cake; everything in it is styled inline.
 */
export async function buildKeepsake(s: View, stage: HTMLElement): Promise<{ html: string; name: string }> {
  const map: Record<string, string> = {};
  for (const u of new Set(Object.values(s.picks).map((p) => p.img).filter(Boolean) as string[])) map[norm(u)] = await toDataUrl(u);

  const clone = stage.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[title]').forEach((el) => el.removeAttribute('title'));
  clone.querySelectorAll<HTMLElement | SVGElement>('*').forEach((el) => {
    const m = el.style && /^url\("(.*)"\)$/.exec(el.style.backgroundImage || '');
    if (m && map[m[1]]) el.style.backgroundImage = 'url("' + map[m[1]] + '")';
    if (el.style) el.style.cursor = '';
  });
  clone.style.overflow = 'visible';
  clone.style.cursor = '';

  const pl = Object.fromEntries(s.players.map((p) => [p.id, p]));
  const who = (id: string) => (id === 'me' ? s.name : (pl[id] || { name: '' }).name || '');
  const imgOf = (id: string) => {
    const p = s.picks[id] || {};
    return p.img ? map[norm(p.img)] || p.img : null;
  };
  const labelOf = (id: string) => (s.picks[id] || {}).label || who(id) + "'s pick";
  const pic = (id: string, css: string) => {
    const p = s.picks[id] || {},
      im = imgOf(id);
    return im
      ? '<div style="' + css + ';background:#FFE9D2 center/cover no-repeat;background-image:url(&quot;' + esc(im) + '&quot;)' + (p.flip ? ';transform:scaleX(-1)' : '') + '"></div>'
      : '<div style="' +
          css +
          ';display:flex;align-items:center;justify-content:center;padding:8px;text-align:center;font:800 13px Hanken Grotesk,sans-serif;color:#5E5263;background:repeating-linear-gradient(135deg,#FFE3EE 0 10px,#FFD1E3 10px 20px)">' +
          esc(labelOf(id)) +
          '</div>';
  };
  const card = (id: string) => {
    const p = s.picks[id] || {},
      r = s.reacts[id] || {},
      o = pl[id] || { color: '#DCD6E0' };
    return (
      '<article style="background:#fff;border:2px solid #1C1520;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 5px 0 #1C1520">' +
      pic(id, 'height:210px') +
      '<div style="padding:16px;display:flex;flex-direction:column;gap:6px"><div style="font:400 19px/1.15 Bowlby One,sans-serif">' +
      esc(labelOf(id)) +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:14px;color:#5E5263"><span style="width:10px;height:10px;border-radius:50%;background:' +
      esc(o.color) +
      '"></span>' +
      esc(who(id)) +
      '</div>' +
      (p.caption ? '<div style="font-size:15px;font-style:italic;color:#3A2F3E;white-space:pre-line">“' + esc(p.caption) + '”</div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:14px;color:#5E5263;margin-top:4px">' +
      REACTS.map((q) => '<span>' + q[2] + ' ' + (r[q[0]] || 0) + '</span>').join('') +
      '</div></div></article>'
    );
  };
  const award = (k: 'best' | 'unh', title: string) => {
    const r = s.results && s.results[k];
    if (!r) return '';
    const [id, v] = r,
      tie = k === 'best' ? s.results!.bestTie : s.results!.unhTie;
    return (
      '<div style="display:flex;gap:16px;align-items:center;background:#fff;border:2px solid #1C1520;border-radius:20px;padding:14px;box-shadow:0 5px 0 #1C1520">' +
      pic(id, 'width:88px;height:88px;flex:none;border-radius:14px') +
      '<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><div style="align-self:flex-start;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#FFD43B;color:#1C1520;border:2px solid #1C1520">' +
      title +
      '</div><div style="font:400 20px/1.15 Bowlby One,sans-serif">' +
      esc(labelOf(id)) +
      '</div><div style="font-size:14px;color:#5E5263">' +
      esc(who(id)) +
      "'s pick · " +
      v +
      (v === 1 ? ' vote' : ' votes') +
      (tie ? ' · Tie broken at random' : '') +
      '</div></div></div>'
    );
  };
  // The day the cake was finished (the same moment the plaque shows), not the day the file was saved.
  const date = new Date(s.finishedAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const cakeDesc = recipeLine(s.cake, s.toppings.length, s.strokes.length);
  // Same people the plaque credits: still here, or had a pick revealed.
  const credited = s.players.filter((p) => p.online || s.order.includes(p.id));
  const html =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hear Me Out cake · Room ' +
    esc(s.code) +
    '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Hanken+Grotesk:wght@400;600;700;800&display=swap" rel="stylesheet">' +
    '<style>body{margin:0;background:#FFF6E9;color:#1C1520;font-family:"Hanken Grotesk",sans-serif}*{box-sizing:border-box}</style></head><body>' +
    '<main style="max-width:1120px;margin:0 auto;padding:48px 28px 64px;display:flex;flex-direction:column;gap:40px">' +
    '<header style="display:flex;flex-direction:column;gap:8px"><div style="font:400 52px/1 Bowlby One,sans-serif;letter-spacing:0">Hear Me Out<span style="color:#D61F74">.</span></div>' +
    '<div style="font-size:16px;color:#5E5263">Room ' +
    esc(s.code) +
    ' · ' +
    esc(date) +
    ' · ' +
    credited.map((p) => esc(p.id === 'me' ? s.name : p.name)).join(', ') +
    '</div>' +
    (s.cakeTheme ? '<div style="font-size:18px;font-weight:800">Theme: ' + esc(s.cakeTheme) + '</div>' : '') +
    '</header>' +
    '<section style="display:flex;flex-wrap:wrap;gap:32px;align-items:center"><div style="flex:1 1 420px;max-width:640px;padding-top:24px">' +
    clone.outerHTML +
    '</div>' +
    '<div style="flex:1 1 280px;display:flex;flex-direction:column;gap:14px"><div style="font:400 26px Bowlby One,sans-serif">The cake</div><div style="font-size:15px;color:#5E5263">' +
    esc(cakeDesc) +
    '</div>' +
    award('best', 'Best pick') +
    award('unh', 'Most unhinged') +
    '</div></section>' +
    '<section style="display:flex;flex-direction:column;gap:16px"><div style="font:400 26px Bowlby One,sans-serif">All the hear me outs</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px">' +
    s.order.map(card).join('') +
    '</div></section>' +
    '<footer style="font-size:13px;color:#6E6272">Saved from Hear Me Out.</footer></main></body></html>';
  return { html, name: 'hear-me-out-' + String(s.code).toLowerCase() + '.html' };
}

/** Offers `html` to the player as a file download. */
export function downloadHtml(name: string, html: string) {
  const href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
