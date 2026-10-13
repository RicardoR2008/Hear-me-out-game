// Shapes of the shared room data (stored under rooms/<CODE> in the database).

export type Phase = 'lobby' | 'theme' | 'decorate' | 'submit' | 'reveal' | 'vote' | 'results';
export type Screen = 'join' | 'connecting' | Phase;
export type ThemeMode = 'vote' | 'agreed';
export type ThemeStage = 'suggest' | 'vote' | 'result';
export type ToppingType = 'cherry' | 'blueberry' | 'sprinkles' | 'candle';
export type ToolKey = ToppingType | 'pen';
export type PenKey = 'white' | 'choc' | 'pink' | 'blue' | 'yellow';
export type ReactKey = 'laugh' | 'boo' | 'hear' | 'valid' | 'flag' | 'dead';
export type SpongeKey = 'strawberry' | 'vanilla' | 'chocolate' | 'redvelvet' | 'matcha';
export type FrostingKey = 'pink' | 'cream' | 'orange' | 'mint' | 'ganache';
export type PlateKey = 'plate' | 'stand' | 'gold' | 'wood';
export type LabelPos = 'above' | 'below';
export type DayNight = 'day' | 'night';

/** Firebase hands arrays back as objects when their keys aren't dense. */
export type ArrLike<T> = T[] | Record<string, T>;

export interface CakeSpec {
  sponge: SpongeKey;
  frosting: FrostingKey;
  plate: PlateKey;
}
export type CakePart = keyof CakeSpec;

export interface PlayerRec {
  name?: string;
  char?: number;
  /** When this player took their character. If two end up on one, the most recent choice keeps it. */
  charAt?: number;
  color?: string;
  joinedAt?: number;
  online?: boolean;
}

/** Where a pick card stands on the cake: x/y in % of the cake box, stick length, scale, rotation. */
export interface Placement {
  x: number;
  y: number;
  stick?: number;
  scale?: number;
  rot?: number;
}

export interface PickRec extends Placement {
  flip?: boolean;
  labelPos?: LabelPos;
  /** True while its owner is dragging it. */
  moving?: boolean;
  img?: string;
  label?: string;
  caption?: string;
}

export interface Slot {
  x: number;
  y: number;
  stick: number;
  scale: number;
  rot: number;
}

export interface ToppingRec {
  type: ToppingType;
  x: number;
  y: number;
  by: string;
  rot: number;
  stripe: string;
  at: number;
}

export interface StrokeRec {
  by: string;
  color: string;
  pts: ArrLike<ArrLike<number>>;
  at: number;
}

export interface LogRec {
  by: string;
  text: string;
  at: number;
}

export interface ReactEventRec {
  k: ReactKey;
  by: string;
  pick: string;
  at: number;
}

export interface VoteRec {
  best: string;
  unh: string;
}

export interface ThemeResultRec {
  text: string;
  by: ArrLike<string>;
  votes: number;
  tie: boolean;
  consensus: boolean;
}

/** [pick owner, number of votes] */
export type Award = [string, number];

export interface Meta {
  createdAt?: number;
  host?: string;
  /** The host's heartbeat: refreshed every couple of seconds while the host's screen is awake. */
  hb?: number | null;
  phase?: Phase;
  themeMode?: ThemeMode;
  round?: number;
  themeAgreed?: string;
  cakeTheme?: string;
  themeStage?: ThemeStage | null;
  themeResult?: ThemeResultRec | null;
  sugDoneAt?: number | null;
  voteDoneAt?: number | null;
  themeGoAt?: number | null;
  decoGoAt?: number | null;
  slots?: ArrLike<Slot> | null;
  curtainAt?: number | null;
  order?: ArrLike<string> | null;
  idx?: number;
  part?: number;
  /** Each award is [pick owner, votes]. A tie flag means the winner was drawn at random from the tied picks. */
  results?: { best?: ArrLike<string | number> | null; unh?: ArrLike<string | number> | null; bestTie?: boolean; unhTie?: boolean } | null;
  finishedAt?: number | null;
}

export interface Room {
  meta?: Meta;
  players?: Record<string, PlayerRec>;
  themeSugs?: Record<string, string>;
  themeVotes?: Record<string, string>;
  cake?: Partial<CakeSpec>;
  cakeBy?: Partial<Record<CakePart, string>>;
  toppings?: Record<string, ToppingRec>;
  strokes?: Record<string, StrokeRec>;
  log?: Record<string, LogRec>;
  decoReady?: Record<string, boolean>;
  picks?: Record<string, PickRec>;
  /** Locked in their pick. */
  ready?: Record<string, boolean>;
  /** Said they're ready for the reveal (after locking in). */
  revealOk?: Record<string, boolean>;
  reacts?: Record<string, Partial<Record<ReactKey, number>>>;
  reactEvents?: Record<string, ReactEventRec>;
  votes?: Record<string, VoteRec>;
}
