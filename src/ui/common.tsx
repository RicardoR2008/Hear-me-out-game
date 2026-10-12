import type { ReactNode } from 'react';
import type { ReadyRow, ViewModel } from '../game/viewModel';

/** ☀ / ☾ switch. */
export function DayNight({ toggle }: { toggle: ViewModel['toggle'] }) {
  return (
    <>
      <button
        type="button"
        className="dn-btn"
        onClick={toggle.setDay}
        title="Day mode"
        aria-label="Day mode"
        aria-pressed={!toggle.night}
        style={{ background: toggle.dayBg, color: toggle.dayFg }}
      >
        ☀
      </button>
      <button
        type="button"
        className="dn-btn dn-night"
        onClick={toggle.setNight}
        title="Night mode"
        aria-label="Night mode"
        aria-pressed={toggle.night}
        style={{ background: toggle.nightBg, color: toggle.nightFg }}
      >
        ☾
      </button>
    </>
  );
}

/** "Who's ready" card: one row per player with their status. */
export function ReadyPanel({ rows }: { rows: ReadyRow[] }) {
  return (
    <div className="panel">
      <div className="eyebrow">Who's ready</div>
      {rows.map((p) => (
        <div key={p.key} className="ready-row">
          <div className="avatar avatar-26" style={{ background: p.color }}>
            {p.emoji}
          </div>
          <div className="ready-name">{p.name}</div>
          <div className="ready-status" style={{ color: p.statusColor }}>
            {p.status}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThemeChip({ theme }: { theme: string }) {
  return (
    <div className="theme-chip">
      <span className="theme-chip-k">Theme</span>
      <span className="theme-chip-v">{theme}</span>
    </div>
  );
}

/** Green "you're set" banner with an optional way back. */
export function Banner({ children, action, onAction, tall }: { children: ReactNode; action?: string; onAction?: () => void; tall?: boolean }) {
  return (
    <div className={'banner' + (tall ? ' banner-tall' : '')}>
      <div className="banner-text">{children}</div>
      {action && (
        <button type="button" className="chip-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

export function DashedNote({ children }: { children: ReactNode }) {
  return <div className="dashed-note">{children}</div>;
}

/** Bouncing 👉 👈 around a call to action. */
export function PointingHands({ offset }: { offset: number }) {
  return (
    <>
      <div aria-hidden="true" className="point point-l" style={{ marginTop: offset }}>
        👉
      </div>
      <div aria-hidden="true" className="point point-r" style={{ marginTop: offset }}>
        👈
      </div>
    </>
  );
}
