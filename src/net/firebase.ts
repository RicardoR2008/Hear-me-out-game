import type { FirebaseOptions } from 'firebase/app';
import { clean } from './core';
import type { Net, TxResult } from './types';

/** Logs failed writes instead of leaving unhandled rejections; callers can still await the result. */
const quiet = <T>(p: Promise<T>): Promise<T> => {
  p.catch((e) => console.warn('[hear-me-out] database write failed:', e));
  return p;
};

/**
 * Real online play on Firebase Realtime Database with anonymous sign-in.
 * The SDK is loaded on demand, so practice mode never downloads it.
 */
export async function firebaseNet(cfg: FirebaseOptions): Promise<Net> {
  const [appMod, authMod, dbMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/database'),
  ]);
  const { ref, onValue, get, set, update, remove, push, runTransaction, onDisconnect } = dbMod;
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
  const auth = authMod.getAuth(app);
  const db = dbMod.getDatabase(app);

  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (s) => {
    offset = s.val() || 0;
  });

  const ready = new Promise<string>((resolve, reject) => {
    const un = authMod.onAuthStateChanged(auth, (u) => {
      if (u) {
        un();
        resolve(u.uid);
      }
    });
    authMod.signInAnonymously(auth).catch(reject);
  });

  return {
    mode: 'firebase',
    get uid() {
      return auth.currentUser ? auth.currentUser.uid : null;
    },
    ready: () => ready,
    now: () => Date.now() + offset,
    watch(p, cb, onError) {
      return onValue(
        ref(db, p),
        (s) => cb(s.val()),
        (e) => onError?.(e),
      );
    },
    get: (p) => get(ref(db, p)).then((s) => s.val()),
    set: (p, v) => quiet(set(ref(db, p), clean(v))),
    update: (p, o) => quiet(update(ref(db, p), clean(o))),
    remove: (p) => quiet(remove(ref(db, p))),
    push(p, v) {
      const r = push(ref(db, p));
      void quiet(set(r, clean(v)));
      return r.key as string;
    },
    tx: (p, fn): Promise<TxResult> =>
      runTransaction(ref(db, p), (cur) => {
        const nv = fn(cur);
        return nv === undefined ? undefined : clean(nv);
      }).then((r) => ({ committed: r.committed, val: r.snapshot.val() })),
    presence(p) {
      const r = ref(db, p);
      const stop = onValue(ref(db, '.info/connected'), (s) => {
        if (s.val() === true) {
          void quiet(onDisconnect(r).set(false));
          void quiet(set(r, true));
        }
      });
      return () => {
        stop();
        void quiet(onDisconnect(r).cancel());
      };
    },
    disconnect() {
      /* Firebase notices dropped connections by itself (onDisconnect). */
    },
    pruneRooms(maxAge) {
      const q = dbMod.query(
        ref(db, 'rooms'),
        dbMod.orderByChild('meta/createdAt'),
        dbMod.endAt(Date.now() + offset - maxAge),
        dbMod.limitToFirst(25),
      );
      return get(q)
        .then((s) => {
          const u: Record<string, null> = {};
          s.forEach((c) => {
            if (c.key) u[c.key] = null;
          });
          if (Object.keys(u).length) return update(ref(db, 'rooms'), u);
        })
        .catch(() => {
          /* pruning is best effort */
        });
    },
  };
}
