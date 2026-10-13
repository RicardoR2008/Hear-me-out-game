import { useState, type CSSProperties } from 'react';
import { CUR } from '../game/constants';
import type { CurtainState } from '../game/controller';
import { mulberry } from '../game/util';

// Velvet stage curtains that close over the pick screen, a three-second alarm clock, then open on the reveal.

/** Folds of red velvet as a gradient (seeded, so both panels look the same on every device). */
const fabric = (seed: number) => {
  const r = mulberry(seed),
    ws: number[] = [];
  let sum = 0;
  while (sum < 100) {
    const w = 6 + r() * 8;
    ws.push(w);
    sum += w;
  }
  const k = 100 / sum,
    HI = ['#E0303A', '#D42430', '#EA3B44', '#C91D28'],
    st: string[] = [];
  let a = 0;
  for (const w0 of ws) {
    const w = w0 * k,
      P = (t: number) => (a + w * t).toFixed(2) + '%',
      hi = HI[Math.floor(r() * HI.length)];
    st.push('#2A0105 ' + P(0), '#7E0A13 ' + P(0.1), '#B8121C ' + P(0.3), hi + ' ' + P(0.5), '#BE141E ' + P(0.68), '#850B14 ' + P(0.88), '#2E0106 ' + P(1));
    a += w;
  }
  return 'linear-gradient(180deg,rgba(25,0,4,.62) 0%,rgba(25,0,4,0) 22%,rgba(25,0,4,0) 70%,rgba(25,0,4,.66) 100%),linear-gradient(90deg,' + st.join(',') + ')';
};

/** Dark creases running down from the rail and up from the floor. */
const streaks = (seed: number) => {
  const r = mulberry(seed),
    o: { x: number; w: number; h: number; top: boolean; a: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const top = r() < 0.6;
    o.push({ x: +(2 + r() * 94).toFixed(2), w: +(0.35 + r() * 1.1).toFixed(2), h: +(12 + r() * 44).toFixed(1), top, a: +(0.45 + r() * 0.4).toFixed(2) });
  }
  return o;
};

const CURTAIN = { left: { bg: fabric(7), st: streaks(21) }, right: { bg: fabric(19), st: streaks(43) } };
const K = '#1C1520';

function Panel({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const L = side === 'left',
    cfg = CURTAIN[side];
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: '53%',
        overflow: 'hidden',
        background: cfg.bg,
        transformOrigin: '50% 0',
        willChange: 'transform',
        zIndex: L ? 1 : 2,
        boxShadow: L ? 'inset -1.4vw 0 2vw rgba(20,0,3,.5)' : 'inset 1.4vw 0 2vw rgba(20,0,3,.5),-0.5vw 0 1.4vw rgba(0,0,0,.45)',
        animation: open
          ? (L ? 'hmoCurtOutL ' : 'hmoCurtOutR ') + CUR.open + 'ms cubic-bezier(.55,0,.3,1) forwards'
          : (L ? 'hmoCurtInL ' : 'hmoCurtInR ') + CUR.close + 'ms cubic-bezier(.5,0,.25,1) both',
      }}
    >
      {cfg.st.map((q, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (L ? q.x : 100 - q.x - q.w) + '%',
            [q.top ? 'top' : 'bottom']: 0,
            width: q.w + '%',
            height: q.h + '%',
            background: 'linear-gradient(' + (q.top ? 180 : 0) + 'deg,rgba(14,0,2,' + q.a + '),rgba(14,0,2,0))',
            clipPath: q.top ? 'polygon(0 0,100% 0,55% 100%)' : 'polygon(45% 0,100% 100%,0 100%)',
          }}
        />
      ))}
    </div>
  );
}

const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return i ? (
    <circle key={'t' + i} cx={+(100 + 84 * Math.sin(a)).toFixed(2)} cy={+(100 - 84 * Math.cos(a)).toFixed(2)} r={3.2} fill="#fff" />
  ) : (
    <circle key="t0" cx={100} cy={16} r={5.5} fill="#FFD43B" stroke={K} strokeWidth={2.5} />
  );
});

function Clock({ phase, n, t }: { phase: CurtainState['phase']; n: number; t: number }) {
  // Sync the sweeping hand to the shared clock, even if this screen joined the countdown late.
  const [lag] = useState(() => Math.max(0, t - CUR.close));
  const sweep: CSSProperties = { animationDelay: -lag + 'ms' };
  const open = phase === 'open',
    num = String(n);
  const T = (k: string, p: Record<string, string | number>) => (
    <text key={k} x={100} y={100} dy="0.36em" textAnchor="middle" fontFamily="'Bowlby One',sans-serif" fontSize={104} {...p}>
      {num}
    </text>
  );
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 'min(62vmin,340px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', zIndex: 4 }}>
      <div style={{ width: '100%', height: '100%', animation: open ? 'hmoClockOut 450ms cubic-bezier(.5,0,.75,0) forwards' : 'hmoClockIn 650ms cubic-bezier(.3,1.5,.5,1) both' }}>
        <div style={{ width: '100%', height: '100%', animation: phase === 'count' ? 'hmoTick 1s ease-in-out infinite' : 'hmoRing 90ms linear infinite' }}>
          <svg viewBox="0 0 200 210" role="img" aria-label={phase === 'count' ? num + ' seconds' : 'Time'} style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
            <defs>
              <radialGradient id="hmo-clk-ring" cx={0.38} cy={0.3} r={0.78}>
                <stop offset={0} stopColor="#FFA8CB" />
                <stop offset={0.5} stopColor="#FF5FA2" />
                <stop offset={1} stopColor="#D63A7C" />
              </radialGradient>
              <radialGradient id="hmo-clk-face" cx={0.42} cy={0.36} r={0.72}>
                <stop offset={0} stopColor="#F4FBFF" />
                <stop offset={1} stopColor="#BCE2FF" />
              </radialGradient>
              <linearGradient id="hmo-clk-num" x1={0} y1={0} x2={0} y2={1}>
                <stop offset={0} stopColor="#FF8A1F" />
                <stop offset={0.5} stopColor="#FFB730" />
                <stop offset={0.5} stopColor="#FFD84A" />
                <stop offset={1} stopColor="#FFF4AE" />
              </linearGradient>
            </defs>
            <circle cx={100} cy={108} r={94} fill={K} />
            <circle cx={100} cy={100} r={94} fill="url(#hmo-clk-ring)" stroke={K} strokeWidth={5} />
            <path d="M17.3 69.9 A88 88 0 0 1 69.9 17.3" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
            {TICKS}
            <circle cx={100} cy={100} r={72} fill="#fff" stroke={K} strokeWidth={4} />
            <circle cx={100} cy={100} r={64} fill="url(#hmo-clk-face)" />
            <circle
              cx={100}
              cy={100}
              r={32}
              fill="none"
              stroke="#5CB8FF"
              strokeWidth={64}
              strokeDasharray="201.06 201.06"
              transform="rotate(-90 100 100)"
              style={{ animation: 'hmoPie ' + CUR.count + 'ms linear forwards', ...sweep }}
            />
            <circle cx={100} cy={100} r={22} fill="none" stroke="#fff" strokeWidth={3} opacity={0.7} />
            <circle cx={100} cy={100} r={42} fill="none" stroke="#fff" strokeWidth={3} opacity={0.7} />
            <g style={{ transformOrigin: '100px 100px', transformBox: 'view-box', animation: 'hmoNeedle ' + CUR.count + 'ms linear forwards', ...sweep }}>
              <line x1={100} y1={110} x2={100} y2={42} stroke={K} strokeWidth={8} strokeLinecap="round" />
            </g>
            <circle cx={100} cy={100} r={9} fill="#FFD43B" stroke={K} strokeWidth={4} />
            <g key={'n' + num} style={{ transformOrigin: '100px 100px', transformBox: 'view-box', animation: 'hmoNum 520ms cubic-bezier(.3,1.6,.5,1) both' }}>
              <g transform="translate(100 100) skewX(-7) translate(-100 -100)">
                {T('o', { fill: '#fff', stroke: '#fff', strokeWidth: 24, strokeLinejoin: 'round' })}
                {T('i', { fill: K, stroke: K, strokeWidth: 12, strokeLinejoin: 'round' })}
                {T('f', { fill: 'url(#hmo-clk-num)' })}
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export function Curtain({ curtain }: { curtain: CurtainState }) {
  const ph = curtain.phase,
    open = ph === 'open';
  return (
    <div aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 5000, overflow: 'hidden' }}>
      <Panel side="left" open={open} />
      <Panel side="right" open={open} />
      {ph !== 'close' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              pointerEvents: 'none',
              background: 'radial-gradient(ellipse 36% 44% at 50% 50%,rgba(255,226,170,.3),rgba(255,200,140,.1) 55%,rgba(255,200,140,0) 75%)',
              animation: open ? 'hmoFadeOut 300ms ease forwards' : 'hmoFadeIn 400ms ease both',
            }}
          />
          <Clock phase={ph} n={curtain.n} t={curtain.t} />
        </>
      )}
    </div>
  );
}
