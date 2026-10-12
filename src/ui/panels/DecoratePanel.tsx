import type { CSSProperties } from 'react';
import type { ViewModel } from '../../game/viewModel';
import { Banner, ReadyPanel, ThemeChip } from '../common';

export function DecoratePanel({ vm }: { vm: ViewModel['decorate'] }) {
  return (
    <div className="stack-22">
      <div className="head">
        <h2 className="head-title">Decorate together</h2>
        <div className="head-sub">Everyone can change the cake at the same time, and the whole room sees it live.</div>
        {vm.hasTheme && <ThemeChip theme={vm.cakeTheme} />}
      </div>
      <div className="tools" style={{ opacity: vm.toolsOpacity, pointerEvents: vm.toolsPE as CSSProperties['pointerEvents'] }}>
        {vm.swatchGroups.map((g) => (
          <div key={g.title} className="swatch-group">
            <div className="swatch-head">
              <span className="eyebrow">{g.title}</span>
              <span className="swatch-note">{g.note}</span>
            </div>
            <div className="swatches">
              {g.opts.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className="swatch"
                  onClick={o.onClick}
                  disabled={vm.toolsOff}
                  aria-pressed={o.on}
                  style={{ borderColor: o.border, background: o.bg, boxShadow: o.shadow }}
                >
                  <span className="swatch-dot" style={{ background: o.color }} />
                  <span className="nowrap">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="eyebrow">Live activity</div>
        {!vm.activity.length && <div className="faint-14">Nobody has touched the cake yet.</div>}
        {vm.activity.map((a) => (
          <div key={a.id} className="activity-row">
            <div className="avatar avatar-22" style={{ background: a.color }}>
              {a.emoji}
            </div>
            <span>{a.text}</span>
          </div>
        ))}
      </div>
      <ReadyPanel rows={vm.readyList} />
      {!vm.meDone ? (
        <div className="row-10">
          <button type="button" className="btn btn-plain btn-undo" onClick={vm.undo} disabled={vm.cantUndo} style={{ opacity: vm.undoOpacity }}>
            Undo mine
          </button>
          <button type="button" className="btn btn-big btn-pink grow" onClick={vm.finish}>
            I finished decorating
          </button>
        </div>
      ) : (
        <Banner tall action="Keep decorating" onAction={vm.keepDecorating}>
          <span className="pretty">{vm.waitText}</span>
        </Banner>
      )}
    </div>
  );
}
