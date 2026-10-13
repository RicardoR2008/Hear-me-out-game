// One small API shared by every backend:
//   firebase  real online play (Firebase Realtime Database + anonymous sign-in)
//   local     practice mode: tabs/windows on the same device and browser
//   memory    tests: many clients sharing one in-memory tree

export type NetMode = 'firebase' | 'local' | 'memory';
export type Unsubscribe = () => void;

export interface TxResult {
  committed: boolean;
  val: unknown;
}

export interface Net {
  readonly mode: NetMode;
  /** Set when Firebase was configured but failed to start, so practice mode was used instead. */
  fallbackReason?: string;
  readonly uid: string | null;
  /** Resolves with this player's id once signed in. */
  ready(): Promise<string>;
  /** Shared clock. Under Firebase it is corrected to server time so timers line up across devices. */
  now(): number;
  /** Calls `cb` with the value at `path` now and after every change. */
  watch(path: string, cb: (value: unknown) => void, onError?: (e: Error) => void): Unsubscribe;
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  /** Multi-path update; keys may contain slashes. A null value deletes. */
  update(path: string, values: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** Adds a child under `path` with a time-ordered key and returns the key. */
  push(path: string, value: unknown): string;
  /** Atomic read-modify-write. Return undefined from `fn` to abort. */
  tx(path: string, fn: (current: unknown) => unknown): Promise<TxResult>;
  /** Keeps `path` true while this client is connected and false once it goes away. Returns a stopper. */
  presence(path: string): Unsubscribe;
  /** Calls `cb` with true/false whenever the connection to the database comes or goes (right away with the current state). */
  onConnected(cb: (connected: boolean) => void): Unsubscribe;
  /** Simulates this client dropping off (practice and test backends). */
  disconnect(): void;
  /** Simulates the connection going away and coming back (in-memory backends, for tests). */
  setConnected?(connected: boolean): void;
  /** Deletes rooms created more than `maxAgeMs` ago. */
  pruneRooms(maxAgeMs: number): Promise<void>;
}
