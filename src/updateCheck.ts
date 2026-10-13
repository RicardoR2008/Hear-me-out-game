// Notices when a newer version of the game has been published while this page is open,
// so a tab left open for a while doesn't keep playing by old rules alongside newer players.

/** The game's main script named in a page, e.g. "index-D1QrpTaG.js" ('' if there is none). */
export const buildOf = (html: string) => (/assets\/(index-[\w-]+\.js)/.exec(html) || ['', ''])[1];

/** True when `html` (a fresh copy of the page) loads a different build than the one running (`current`). */
export const isNewerBuild = (html: string, current: string) => {
  const b = buildOf(html);
  return !!b && !!current && b !== current;
};

const EVERY_MS = 5 * 60 * 1000;
const FIRST_MS = 30 * 1000;
const MIN_GAP_MS = 60 * 1000;

/**
 * Looks for a newer build now and then, and whenever the tab comes back into view.
 * Calls `onNew` once when one is out. `current` is the running script's file name.
 */
export function watchForUpdates(current: string, onNew: () => void) {
  // The dev server has no built file name to compare with.
  if (!/^index-[\w-]+\.js$/.test(current)) return;
  let last = 0,
    found = false;
  const check = async () => {
    if (found || Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    try {
      const r = await fetch('./?v=' + Date.now(), { cache: 'no-store' });
      if (r.ok && isNewerBuild(await r.text(), current)) {
        found = true;
        onNew();
      }
    } catch {
      /* offline right now: try again later */
    }
  };
  setTimeout(() => void check(), FIRST_MS);
  setInterval(() => void check(), EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
