import { Core, memoryNet, type Op } from './core';
import type { Net } from './types';

const KEY = 'hmo-local-db-v1';
const CHANNEL = 'hmo-local-v1';

/**
 * Practice mode: one database shared by every tab of this browser.
 * Changes travel between tabs over a BroadcastChannel and are saved to localStorage.
 * Add `?seat=B` (any name) to a tab's URL to play as a different person in that tab.
 */
export function localNet(): Net {
  let root: Record<string, unknown> = {};
  try {
    root = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    /* corrupted or blocked storage: start empty */
  }
  const core = new Core(root);
  const applyLocal = core.apply.bind(core);
  let bc: BroadcastChannel | null = null;
  let saveT: number | undefined;
  const saveNow = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(core.root));
    } catch {
      /* quota exceeded: live tabs still sync over the channel */
    }
  };
  const save = () => {
    clearTimeout(saveT);
    saveT = window.setTimeout(saveNow, 150);
  };
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e: MessageEvent<{ t?: string; ops?: Op[] }>) => {
      if (e.data && e.data.t === 'ops' && e.data.ops) applyLocal(e.data.ops);
    };
  } catch {
    /* no BroadcastChannel: single tab only */
  }
  core.apply = (ops: Op[]) => {
    applyLocal(ops);
    if (bc) bc.postMessage({ t: 'ops', ops });
    save();
  };

  let seat = '';
  try {
    seat = new URLSearchParams(location.search).get('seat') || '';
  } catch {
    /* ignore */
  }
  const UK = 'hmo-local-uid' + (seat ? '-' + seat : '');
  let uid: string | null = null;
  try {
    uid = sessionStorage.getItem(UK);
  } catch {
    /* ignore */
  }
  if (!uid) {
    uid = 't' + (seat ? seat + 'x' : '') + Math.random().toString(36).slice(2, 10);
    try {
      sessionStorage.setItem(UK, uid);
    } catch {
      /* ignore */
    }
  }

  const api = memoryNet(core, { uid, mode: 'local' });
  window.addEventListener('pagehide', () => {
    api.disconnect();
    saveNow();
  });
  return api;
}
