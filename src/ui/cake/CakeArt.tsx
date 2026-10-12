// The cake drawing and the frosting-pen layer. Styled inline on purpose:
// the keepsake export copies this markup into a standalone page.
import type { CSSProperties, ReactElement } from 'react';
import { FR, SP } from '../../game/constants';
import type { ViewStroke } from '../../game/controller';
import { ART, GB, GRX, GRY, GT, GX, VB } from '../../game/geometry';
import type { CakeSpec } from '../../game/types';

type Stop = [number, string, number?];

const FILL: CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' };

const stops = (s: Stop[]) => s.map(([o, col, al], i) => <stop key={i} offset={o} style={{ stopColor: col, stopOpacity: al ?? 1 }} />);
const lin = (id: string, s: Stop[]) => (
  <linearGradient key={id} id={id} x1={0} y1={0} x2={1} y2={0}>
    {stops(s)}
  </linearGradient>
);
const rad = (id: string, s: Stop[], p: Record<string, number | string> = {}) => (
  <radialGradient key={id} id={id} {...p}>
    {stops(s)}
  </radialGradient>
);
const ell = (k: string, cx: number, cy: number, rx: number, ry: number, fill: string, filter?: string) => (
  <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={ry} style={{ fill }} filter={filter} />
);

export function CakeArt({ cake }: { cake: CakeSpec }) {
  const sp = SP[cake.sponge],
    fr = FR[cake.frosting],
    A = ART;
  let plate: ReactElement[];
  if (cake.plate === 'stand')
    plate = [
      ell('ps', 50, 103.6, 18, 1.6, 'rgba(60,30,10,0.25)', 'url(#hmo-blur)'),
      ell('pb2', 50, 101.4, 15, 2.8, 'oklch(0.82 0.012 250)'),
      ell('pb', 50, 100.7, 15, 2.8, 'url(#hmo-glass)'),
      <path key="stem" d="M45.5 94 L54.5 94 L52.8 100.7 L47.2 100.7 Z" style={{ fill: 'url(#hmo-glass-lin)' }} />,
      ell('pt2', 50, 86.8, 43, 10.8, 'oklch(0.84 0.012 250)'),
      ell('pt', 50, 85.6, 43, 10.8, 'url(#hmo-glass)'),
    ];
  else {
    const P = {
      plate: ['url(#hmo-plate)', 'oklch(0.86 0.01 60)', 1.4],
      gold: ['url(#hmo-gold)', 'oklch(0.56 0.1 70)', 1.6],
      wood: ['url(#hmo-wood)', 'oklch(0.47 0.07 50)', 2.6],
    }[cake.plate] as [string, string, number];
    plate = [ell('ps', 50, 90 + P[2], 46, 11, 'rgba(60,30,10,0.2)', 'url(#hmo-blur)'), ell('pe', 50, 85.5 + P[2], 46, 12, P[1]), ell('pt', 50, 85.5, 46, 12, P[0])];
    if (cake.plate === 'plate')
      plate.push(<ellipse key="pw" cx={50} cy={85.5} rx={38} ry={9.6} style={{ fill: 'none', stroke: 'oklch(0.9 0.008 60)', strokeWidth: 0.4 }} />);
  }
  return (
    <svg viewBox="0 0 100 105" preserveAspectRatio="none" style={{ ...FILL, overflow: 'visible' }} aria-hidden="true">
      <defs>
        {lin('hmo-sponge', [
          [0, sp.d],
          [0.2, sp.c],
          [0.65, sp.c],
          [1, sp.d],
        ])}
        {lin('hmo-shade', [
          [0, '#000', 0.22],
          [0.14, '#000', 0],
          [0.3, '#fff', 0.18],
          [0.44, '#fff', 0],
          [0.78, '#000', 0.04],
          [1, '#000', 0.26],
        ])}
        {rad(
          'hmo-top',
          [
            [0, fr.hl],
            [0.55, fr.c],
            [1, fr.s],
          ],
          { cx: 0.42, cy: 0.38, r: 0.7 },
        )}
        {rad(
          'hmo-dollop',
          [
            [0, fr.hl],
            [0.45, fr.c],
            [1, fr.d],
          ],
          { cx: 0.5, cy: 0.5, fx: 0.36, fy: 0.3, r: 0.62 },
        )}
        {rad('hmo-plate', [
          [0, '#fff'],
          [0.72, '#fff'],
          [1, 'oklch(0.93 0.006 60)'],
        ])}
        {lin('hmo-gold', [
          [0, 'oklch(0.68 0.11 76)'],
          [0.35, 'oklch(0.9 0.08 92)'],
          [0.6, 'oklch(0.8 0.1 85)'],
          [1, 'oklch(0.64 0.11 74)'],
        ])}
        {rad(
          'hmo-wood',
          [
            [0, 'oklch(0.71 0.08 62)'],
            [0.5, 'oklch(0.66 0.08 58)'],
            [1, 'oklch(0.71 0.08 62)'],
          ],
          { r: 0.13, spreadMethod: 'repeat' },
        )}
        {rad('hmo-glass', [
          [0, 'oklch(0.99 0.004 250)'],
          [0.7, 'oklch(0.965 0.008 250)'],
          [1, 'oklch(0.9 0.012 250)'],
        ])}
        {lin('hmo-glass-lin', [
          [0, 'oklch(0.82 0.012 250)'],
          [0.4, 'oklch(0.98 0.004 250)'],
          [1, 'oklch(0.8 0.012 250)'],
        ])}
        <filter id="hmo-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={1.4} />
        </filter>
      </defs>
      {plate}
      {ell('cs', 50, A.B + 1.2, A.rx + 1.5, A.ry + 0.6, 'rgba(50,25,10,0.22)', 'url(#hmo-blur)')}
      <path d={A.side} style={{ fill: 'url(#hmo-sponge)' }} />
      {A.bands.map((d, i) => (
        <path key={'b' + i} d={d} style={{ fill: fr.s }} />
      ))}
      <path d={A.drip} style={{ fill: fr.c }} />
      <path d={A.side} style={{ fill: 'url(#hmo-shade)' }} />
      {ell('top', 50, A.T, A.rx, A.ry, 'url(#hmo-top)')}
      {A.dollops.map((p, i) => ell('d' + i, p[0], p[1], 2.3, 1.75, 'url(#hmo-dollop)'))}
      {A.beads.map((p, i) => ell('e' + i, p[0], p[1], 1.7, 1.45, 'url(#hmo-dollop)'))}
    </svg>
  );
}

/** Frosting-pen lines, clipped to the cake. */
export function DrawLayer({ strokes }: { strokes: ViewStroke[] }) {
  return (
    <svg viewBox="0 0 100 105" preserveAspectRatio="none" style={{ ...FILL, zIndex: 90 }} aria-hidden="true">
      <defs>
        <clipPath id="hmo-cake-clip">
          <ellipse cx={GX} cy={GT * VB} rx={GRX} ry={GRY * VB} />
          <rect x={GX - GRX} y={GT * VB} width={GRX * 2} height={(GB - GT) * VB} />
          <ellipse cx={GX} cy={GB * VB} rx={GRX} ry={GRY * VB} />
        </clipPath>
      </defs>
      <g clipPath="url(#hmo-cake-clip)" style={{ filter: 'drop-shadow(0 0.4px 0.3px rgba(0,0,0,0.25))' }}>
        {strokes.map((st) => (
          <path
            key={st.id}
            d={'M' + st.pts.map((q) => Number(q[0]).toFixed(2) + ' ' + Number(q[1]).toFixed(2)).join(' L')}
            fill="none"
            stroke={st.color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
