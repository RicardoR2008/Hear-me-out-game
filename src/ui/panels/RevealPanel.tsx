import type { CSSProperties } from 'react';
import type { ViewModel } from '../../game/viewModel';
import { DashedNote, PointingHands } from '../common';

export function RevealPanel({ vm }: { vm: ViewModel['reveal'] }) {
  const cur = vm.cur;
  return (
    <div className="stack-18">
      <div className="reveal-top">
        <div className="reveal-count">{vm.label}</div>
        <div className="dots" title={vm.partsTitle}>
          {vm.partDots.map((on, i) => (
            <div key={i} className="dot-part" style={{ background: on ? '#FF5FA2' : 'transparent' }} />
          ))}
        </div>
      </div>
      <div className="reveal-who">
        <div className="reveal-says">
          <div className="avatar avatar-34" style={{ background: cur?.color }}>
            {cur?.emoji}
          </div>
          <span>{cur?.says}</span>
        </div>
        <div className="reveal-hmo">hear me out…</div>
      </div>
      <div className="reveal-stack">
        <div className="relative">
          {vm.presenting && <div aria-hidden="true" className="present-ring" />}
          <div
            className="reveal-card"
            aria-live="polite"
            onClick={
              vm.presenting
                ? (e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('button')) return;
                    vm.showNext();
                  }
                : undefined
            }
            style={{ cursor: vm.presenting ? 'pointer' : 'default' }}
          >
            {!vm.imgShown ? (
              <div className="mystery">
                <div className="mystery-q">?</div>
                <div className="mystery-text">{vm.mysteryText}</div>
                {vm.presenting && (
                  <div className="mystery-pill">
                    <span aria-hidden="true" className="tap">
                      👆
                    </span>
                    <span>Click here to show your pick</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pop">
                {cur?.hasImg ? (
                  <div className="reveal-img" style={{ backgroundImage: cur.bg, transform: cur.flipT }} />
                ) : (
                  <div className="reveal-ph">{vm.curPh}</div>
                )}
              </div>
            )}
            <div className="reveal-body">
              {vm.labelShown ? <div className="reveal-label">{cur?.label}</div> : <div className="ghost-line ghost-label" style={{ width: vm.labelGhostW }} />}
              {vm.lines.map((ln, i) =>
                ln.shown ? (
                  <div key={i} className="reveal-line">
                    {ln.text}
                  </div>
                ) : (
                  <div key={i} className="ghost-line ghost-text" style={{ width: ln.ghostW }} />
                ),
              )}
            </div>
            {vm.presenting && (
              <div className="show-next-bar">
                <button type="button" className="show-next" onClick={vm.showNext}>
                  {vm.showNextLabel}
                </button>
                <PointingHands offset={-15} />
              </div>
            )}
          </div>
        </div>
        {vm.presenting && <div className="present-hint">You're presenting. Click the card or press Space.</div>}
        <div className="reacts" style={{ opacity: vm.canReact ? 1 : 0.4, pointerEvents: vm.canReact ? 'auto' : 'none' }}>
          {vm.reactBtns.map((r) => (
            <button key={r.key} type="button" className="react" onClick={r.onClick} aria-label={`${r.label} (${r.count})`}>
              <span className="react-emoji">{r.emoji}</span>
              <span className="react-label">{r.label}</span>
              <span className="react-count">{r.count}</span>
            </button>
          ))}
        </div>
        <div className="float-layer" aria-hidden="true">
          {vm.floaters.map((f) => {
            const m = Math.ceil(Math.max(f.size * 0.75, f.who ? 40 : 0) + Math.abs(f.dx) + 4);
            return (
              <div
                key={f.id}
                className="floater"
                style={
                  {
                    left: `clamp(${m}px, ${f.x.toFixed(1)}%, calc(100% - ${m}px))`,
                    bottom: (f.b || 70) + 'px',
                    fontSize: f.size.toFixed(0) + 'px',
                    '--dx': f.dx.toFixed(0) + 'px',
                    '--rot': f.rot.toFixed(0) + 'deg',
                    '--rise': f.rise.toFixed(0) + 'px',
                  } as CSSProperties
                }
              >
                {f.emoji}
                {f.who && <span className="floater-who">{f.who}</span>}
              </div>
            );
          })}
        </div>
      </div>
      {vm.otherPresenting && <DashedNote>{vm.presenterText}</DashedNote>}
      {vm.nextWait && <DashedNote>{vm.nextWaitText}</DashedNote>}
      {vm.canNextBtn && (
        <div className="relative">
          <button type="button" className="btn btn-big btn-blue btn-next" onClick={vm.next}>
            {vm.nextLabel}
          </button>
          <PointingHands offset={-17} />
        </div>
      )}
    </div>
  );
}
