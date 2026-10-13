import type { ViewModel } from '../../game/viewModel';

export function ResultsPanel({ vm }: { vm: ViewModel['results'] }) {
  return (
    <div className="stack-18">
      <h2 className="head-title-done">The cake is done.</h2>
      {vm.noWinners && <div className="muted-14">{vm.noWinners}</div>}
      {vm.winners.map((w) => (
        <div key={w.key} className="winner">
          <div className="winner-thumb">{w.hasImg && <div className="img-cover" style={{ backgroundImage: w.bg, transform: w.flipT }} />}</div>
          <div className="winner-text">
            <div className="winner-badge">{w.title}</div>
            <div className="winner-label">{w.label}</div>
            <div className="muted-14">{w.sub}</div>
          </div>
        </div>
      ))}
      <div className="stack-8">
        <button
          type="button"
          className="btn btn-big btn-yellow"
          onClick={vm.saveKeepsake}
          disabled={vm.keepsakeBusy}
          style={{ opacity: vm.keepsakeBusy ? 0.5 : 1 }}
        >
          Save keepsake (.html)
        </button>
        {vm.keepsakeMsg && (
          <div className="muted-13 center" role="status">
            {vm.keepsakeMsg}
          </div>
        )}
      </div>
      <button type="button" className="btn btn-big btn-ink" onClick={vm.playAgain}>
        Bake another
      </button>
    </div>
  );
}
