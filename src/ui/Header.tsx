import type { ViewModel } from '../game/viewModel';
import { DayNight } from './common';

export function Header({ vm, toggle }: { vm: ViewModel['header']; toggle: ViewModel['toggle'] }) {
  return (
    <header className="hdr">
      <div className="hdr-row">
        <div className="hdr-logo">
          Hear Me Out<span className="dot">.</span>
        </div>
        <div className="hdr-room">{vm.roomLabel}</div>
        <div className="hdr-spacer" />
        <div className="hdr-players">
          {vm.players.map((p) => (
            <div key={p.key} title={p.title} className="hdr-player" style={{ opacity: p.op }}>
              {p.host && (
                <span className="hdr-crown" role="img" aria-label="Host">
                  👑
                </span>
              )}
              <div className="hdr-avatar" style={{ background: p.color }}>
                {p.emoji}
              </div>
              {p.ready && (
                <span className="hdr-ready" role="img" aria-label="Ready">
                  ✓
                </span>
              )}
              <div className="hdr-plate" style={{ background: p.plateBg }}>
                {p.name}
              </div>
            </div>
          ))}
        </div>
        <div className="pillbar hdr-controls">
          <button type="button" className="pillbar-leave" onClick={vm.leave} title="Leave room" aria-label="Leave room">
            Leave
          </button>
          <DayNight toggle={toggle} />
        </div>
      </div>
      <nav className="hdr-steps" aria-label="Game steps">
        {vm.steps.map((s) => (
          <div key={s.key} className="step" style={{ borderColor: s.bd, background: s.bg, color: s.fg }}>
            {s.label}
          </div>
        ))}
      </nav>
    </header>
  );
}
