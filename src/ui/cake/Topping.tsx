import type { CSSProperties } from 'react';
import type { ToppingVM } from '../../game/viewModel';

const SPRINKLES: [number, number, string, number][] = [
  [2, 6, 'oklch(0.75 0.15 0)', 30],
  [12, 1, 'oklch(0.86 0.15 95)', -40],
  [21, 9, 'oklch(0.68 0.13 240)', 70],
  [6, 16, 'oklch(0.74 0.15 150)', -12],
  [16, 18, 'oklch(0.78 0.15 55)', 45],
  [24, 2, '#fff', -70],
  [12, 10, 'oklch(0.62 0.15 300)', 10],
];

const sprinkle = (left: number, top: number, background: string, rot: number): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width: 9,
  height: 3,
  borderRadius: 2,
  background,
  transform: `rotate(${rot}deg)`,
});

export function Topping({ t }: { t: ToppingVM }) {
  return (
    <div
      onPointerDown={t.onDown}
      title={t.title || undefined}
      style={{ position: 'absolute', left: t.left, top: t.top, transform: t.tf, zIndex: t.z, pointerEvents: t.pe as CSSProperties['pointerEvents'], cursor: t.cursor }}
    >
      {t.type === 'cherry' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 2, height: 12, borderRadius: 2, background: 'oklch(0.42 0.08 125)', transform: 'rotate(16deg) translateX(3px)', marginBottom: -2 }} />
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 34% 30%,oklch(0.8 0.14 25),oklch(0.55 0.21 25) 55%,oklch(0.42 0.18 25))',
              boxShadow: '0 3px 4px oklch(0.3 0.08 30 / 0.3)',
            }}
          />
        </div>
      )}
      {t.type === 'blueberry' && (
        <div
          style={{
            position: 'relative',
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 30%,oklch(0.62 0.09 265),oklch(0.38 0.11 275) 65%,oklch(0.3 0.09 280))',
            boxShadow: '0 2px 3px oklch(0.25 0.05 280 / 0.35)',
          }}
        >
          <div style={{ position: 'absolute', left: 5, top: 3, width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.25 0.06 280)' }} />
        </div>
      )}
      {t.type === 'sprinkles' && (
        <div style={{ position: 'relative', width: 32, height: 24 }}>
          {SPRINKLES.map(([l, tp, bg, r], i) => (
            <div key={i} style={sprinkle(l, tp, bg, r)} />
          ))}
        </div>
      )}
      {t.type === 'candle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: 10,
              height: 16,
              borderRadius: '50% 50% 50% 50% / 65% 65% 35% 35%',
              background: 'radial-gradient(circle at 50% 72%,oklch(0.98 0.06 95),oklch(0.86 0.16 82) 50%,oklch(0.72 0.19 55))',
              boxShadow: '0 0 14px oklch(0.86 0.16 82 / 0.85)',
            }}
          />
          <div style={{ width: 2, height: 4, background: 'oklch(0.3 0.02 40)' }} />
          <div
            style={{
              width: 9,
              height: 38,
              borderRadius: 2,
              background: `repeating-linear-gradient(160deg,#fff 0 5px,${t.stripe} 5px 10px)`,
              boxShadow: 'inset -2px 0 0 oklch(0 0 0 / 0.08)',
            }}
          />
        </div>
      )}
    </div>
  );
}
