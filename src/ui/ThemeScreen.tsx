import type { ViewModel } from '../game/viewModel';
import { Banner, ReadyPanel } from './common';

export function ThemeScreen({ vm }: { vm: ViewModel['themeStep'] }) {
  return (
    <main className="theme-main">
      <div className="theme-col">
        {vm.suggest && (
          <>
            <div className="head">
              <h2 className="head-title-xl">Pick a theme</h2>
              <div className="head-sub">Everyone suggests one. Then you all vote.</div>
            </div>
            {!vm.mySug && (
              <div className="row-8">
                <input
                  className="field field-idea"
                  value={vm.themeIn}
                  onChange={(e) => vm.onThemeIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      vm.submitSug();
                    }
                  }}
                  maxLength={40}
                  placeholder="Your theme idea"
                  aria-label="Your theme idea"
                />
                <button type="button" className="btn btn-suggest" onClick={vm.submitSug} disabled={vm.cantSug} style={{ opacity: vm.cantSug ? 0.4 : 1 }}>
                  Suggest
                </button>
              </div>
            )}
            {vm.mySug && (
              <Banner action="Change" onAction={vm.changeSug}>
                <span className="banner-wrap">Your idea: {vm.mySug}</span>
              </Banner>
            )}
          </>
        )}
        {vm.vote && (
          <>
            <div className="head">
              <h2 className="head-title-xl">Vote for the theme</h2>
              <div className="head-sub">You cannot vote for your own idea.</div>
            </div>
            <div className="idea-list">
              {vm.optCards.map((o) => (
                <div key={o.key} className="idea">
                  <div className="idea-text">{o.text}</div>
                  {o.mine ? (
                    <div className="idea-yours">Yours</div>
                  ) : (
                    <button type="button" className="btn idea-vote" onClick={o.onVote} style={{ background: o.bg, color: o.fg }}>
                      {o.voteLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {vm.result && (
          <div className="theme-result">
            <div className="theme-result-k">Tonight's theme</div>
            <div className="pop">
              <div className="theme-ticket">{vm.winner}</div>
            </div>
            <div className="theme-result-note">{vm.winNote}</div>
            <div className="theme-result-go">{vm.goText}</div>
          </div>
        )}
        {vm.showStatus && <ReadyPanel rows={vm.status} />}
      </div>
    </main>
  );
}
