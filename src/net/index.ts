import type { FirebaseOptions } from 'firebase/app';
import { firebaseNet } from './firebase';
import { localNet } from './local';
import type { Net } from './types';

export type { Net } from './types';

declare global {
  interface Window {
    /** Set by public/hmo-config.js. */
    HMO_FIREBASE_CONFIG?: FirebaseOptions | null;
  }
}

/** Online play when public/hmo-config.js has Firebase settings, practice mode otherwise. */
export async function createNet(): Promise<Net> {
  const cfg = window.HMO_FIREBASE_CONFIG;
  if (cfg && cfg.apiKey && cfg.databaseURL) {
    try {
      return await firebaseNet(cfg);
    } catch (e) {
      const n = localNet();
      n.fallbackReason = e instanceof Error ? e.message : String(e);
      return n;
    }
  }
  return localNet();
}
