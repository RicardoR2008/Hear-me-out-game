import type { ViewModel } from '../game/viewModel';

export function LobbyScreen({ vm }: { vm: ViewModel['lobby'] }) {
  return (
    <main className="lobby">
      <div className="lobby-code-wrap">
        <div className="lobby-share">Share this code with your friends</div>
        <div className="lobby-code">{vm.code}</div>
      </div>
      <section className="lobby-select">
        <div className="lobby-select-head">
          <h2 className="lobby-select-title">Player select</h2>
          <div className="lobby-select-sub">Tap a character to play as them.</div>
        </div>
        <div className="char-grid">
          {vm.chars.map((c) => (
            <button key={c.key} type="button" className="char" onClick={c.onPick} disabled={c.locked} title={c.title} style={{ cursor: c.cursor }}>
              <div className="char-art" style={{ background: `radial-gradient(circle at 50% 42%,${c.glow} 0%,#2B2131 64%,#1C1520 100%)`, borderColor: c.frame }}>
                <span className="char-emoji">{c.emoji}</span>
                {c.tag && (
                  <div className="char-tag" style={{ background: c.tagBg }}>
                    {c.tag}
                  </div>
                )}
              </div>
              <div className="char-name">{c.name}</div>
            </button>
          ))}
        </div>
      </section>
      <div className="lobby-theme">
        <div className="eyebrow">Theme</div>
        <div className="seg seg-wrap">
          {vm.themeModeOpts.map((m) => (
            <button
              key={m.key}
              type="button"
              className="seg-opt seg-mode"
              onClick={m.onClick}
              aria-pressed={m.on}
              style={{ background: m.bg, color: m.fg, cursor: vm.isHost ? 'pointer' : 'default' }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {vm.isAgreed && (
          <input
            className="field"
            value={vm.themeAgreed}
            onChange={(e) => vm.onThemeAgreed(e.target.value)}
            readOnly={!vm.isHost}
            maxLength={40}
            placeholder="Tonight's theme"
            aria-label="Tonight's theme"
          />
        )}
        <div className="muted-14">{vm.themeModeNote}</div>
      </div>
      <div className="lobby-start">
        <button type="button" className="btn btn-big btn-green btn-start" onClick={vm.start} disabled={vm.cantStart} style={{ opacity: vm.startOpacity }}>
          Start the cake
        </button>
        <div className="muted-13">{vm.note}</div>
      </div>
    </main>
  );
}
