import type { CakeSpec, FrostingKey, PenKey, PlateKey, ReactKey, SpongeKey, ToolKey, ToppingType } from './types';

export const MAXP = 12;
export const MINP = 2;

/** Player colors, handed out in order so nobody in a room shares one. */
export const COLORS = ['#FF8A5C', '#6FA8FF', '#4DD9A6', '#FFD43B', '#FF7EB6', '#5ED3E8', '#B79CFF', '#FF6B6B', '#9BD45E', '#FFB347', '#E4A0FF', '#7FD8C8'];

export interface Character {
  n: string;
  e: string;
  /** Glow behind the character on the player-select tile. */
  g: string;
}
export const CHARS: Character[] = [
  { n: 'Ribbit', e: '🐸', g: '#4DD9A6' },
  { n: 'Bandit', e: '🦝', g: '#B8B0C8' },
  { n: 'Inky', e: '🐙', g: '#FF7EB6' },
  { n: 'Sparkle', e: '🦄', g: '#B79CFF' },
  { n: 'Zorp', e: '👽', g: '#8CF07E' },
  { n: 'Beep', e: '🤖', g: '#5ED3E8' },
  { n: 'Wisp', e: '👻', g: '#E4DEEE' },
  { n: 'Rex', e: '🦖', g: '#9BD45E' },
  { n: 'Mochi', e: '🐱', g: '#FFB347' },
  { n: 'Quack', e: '🦆', g: '#FFD43B' },
  { n: 'Shelly', e: '🐌', g: '#FF9E7A' },
  { n: 'Bruno', e: '🐻', g: '#D9A066' },
];
export const charEmoji = (i: number) => (CHARS[i] || { e: '' }).e;

export const REACTS: [ReactKey, string, string][] = [
  ['laugh', 'Laugh', '😂'],
  ['boo', 'Boo', '🍅'],
  ['hear', 'Hear you out', '👂'],
  ['valid', 'Valid', '😍'],
  ['flag', 'Red flag', '🚩'],
  ['dead', 'Dead', '💀'],
];

export const SP: Record<SpongeKey, { label: string; c: string; d: string }> = {
  strawberry: { label: 'Strawberry', c: 'oklch(0.8 0.09 12)', d: 'oklch(0.67 0.1 12)' },
  vanilla: { label: 'Vanilla', c: 'oklch(0.89 0.07 88)', d: 'oklch(0.77 0.08 78)' },
  chocolate: { label: 'Chocolate', c: 'oklch(0.46 0.07 45)', d: 'oklch(0.35 0.06 42)' },
  redvelvet: { label: 'Red velvet', c: 'oklch(0.5 0.16 22)', d: 'oklch(0.39 0.14 22)' },
  matcha: { label: 'Matcha', c: 'oklch(0.76 0.1 130)', d: 'oklch(0.63 0.1 130)' },
};

export const FR: Record<FrostingKey, { label: string; hl: string; c: string; s: string; d: string }> = {
  pink: { label: 'Pink', hl: 'oklch(0.97 0.025 12)', c: 'oklch(0.92 0.05 12)', s: 'oklch(0.87 0.065 12)', d: 'oklch(0.78 0.08 12)' },
  cream: { label: 'Cream', hl: 'oklch(0.995 0.008 85)', c: 'oklch(0.96 0.03 85)', s: 'oklch(0.92 0.04 82)', d: 'oklch(0.84 0.05 78)' },
  orange: { label: 'Orange', hl: 'oklch(0.88 0.1 65)', c: 'oklch(0.79 0.14 58)', s: 'oklch(0.73 0.15 54)', d: 'oklch(0.63 0.15 48)' },
  mint: { label: 'Mint', hl: 'oklch(0.96 0.04 165)', c: 'oklch(0.9 0.07 165)', s: 'oklch(0.85 0.08 165)', d: 'oklch(0.76 0.09 165)' },
  ganache: { label: 'Ganache', hl: 'oklch(0.56 0.06 45)', c: 'oklch(0.42 0.06 40)', s: 'oklch(0.37 0.055 40)', d: 'oklch(0.28 0.04 38)' },
};

export const PL: Record<PlateKey, { label: string; c: string }> = {
  plate: { label: 'White plate', c: '#fff' },
  stand: { label: 'Cake stand', c: 'oklch(0.9 0.012 250)' },
  gold: { label: 'Gold board', c: 'linear-gradient(90deg,oklch(0.74 0.11 82),oklch(0.9 0.08 92),oklch(0.7 0.11 78))' },
  wood: { label: 'Wood board', c: 'oklch(0.68 0.08 60)' },
};

export const PENS: Record<PenKey, [string, string]> = {
  white: ['White', '#fff'],
  choc: ['Chocolate', 'oklch(0.38 0.06 40)'],
  pink: ['Pink', 'oklch(0.72 0.14 0)'],
  blue: ['Blue', 'oklch(0.65 0.13 240)'],
  yellow: ['Yellow', 'oklch(0.86 0.15 95)'],
};

export const TOOLS: [ToolKey, string, string][] = [
  ['cherry', 'Cherry', 'oklch(0.55 0.2 25)'],
  ['blueberry', 'Blueberry', 'oklch(0.42 0.11 275)'],
  ['sprinkles', 'Sprinkles', 'conic-gradient(oklch(0.75 0.15 0),oklch(0.86 0.15 95),oklch(0.68 0.13 240),oklch(0.74 0.15 150),oklch(0.75 0.15 0))'],
  ['candle', 'Candle', 'repeating-linear-gradient(135deg,#fff 0 3px,oklch(0.7 0.15 250) 3px 6px)'],
  ['pen', 'Frosting pen', ''],
];

export const NOUN: Record<ToppingType, string> = { cherry: 'a cherry', blueberry: 'a blueberry', sprinkles: 'sprinkles', candle: 'a candle' };

/** Candle stripe colors. */
export const STRIPES = ['oklch(0.7 0.15 250)', 'oklch(0.72 0.16 0)', 'oklch(0.75 0.14 150)', 'oklch(0.8 0.14 70)'];

export const newCake = (): CakeSpec => ({ sponge: 'strawberry', frosting: 'pink', plate: 'plate' });

// Theme-aware colors for inline styles (custom properties are defined in styles.css).
export const INK = 'var(--ink,#1C1520)';
export const INKC = '#1C1520';
export const ACC = '#FF5FA2';
export const LINE = 'var(--line,#1C1520)';

/** Step bar: one color per phase. */
export const STEPS: { key: string; label: string; color: string }[] = [
  { key: 'lobby', label: 'Lobby', color: '#FFD43B' },
  { key: 'theme', label: 'Theme', color: '#FF8A5C' },
  { key: 'decorate', label: 'Decorate', color: '#4DD9A6' },
  { key: 'submit', label: 'Pick', color: '#FF5FA2' },
  { key: 'reveal', label: 'Reveal', color: '#5CB8FF' },
  { key: 'vote', label: 'Vote', color: '#B79CFF' },
  { key: 'results', label: 'Results', color: '#FF6B45' },
];

/** Curtain timings (ms): close, three-second countdown, alarm ring, open. */
export const CUR = { close: 800, count: 3000, ring: 450, open: 950 };
/** Time from curtainAt until the curtain overlay is gone. */
export const CURTAIN_TOTAL = CUR.close + CUR.count + CUR.ring + CUR.open + 60;

export const ROOM_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_MAX_AGE_MS = 24 * 3600 * 1000;
