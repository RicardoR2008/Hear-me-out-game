import type { ViewModel } from '../game/viewModel';

export function VoteScreen({ vm }: { vm: ViewModel['vote'] }) {
  return (
    <main className="vote">
      <div className="vote-top">
        <div className="head">
          <h2 className="head-title-vote">Vote</h2>
          <div className="head-sub">Pick one Best and one Most unhinged. You can't vote for yourself.</div>
        </div>
        <button type="button" className="btn btn-big btn-tomato btn-submit-votes" onClick={vm.submit} disabled={vm.cantVote} style={{ opacity: vm.voteOpacity }}>
          Submit votes
        </button>
        {vm.hasVoted && <div className="vote-wait">{vm.waitText}</div>}
      </div>
      <div className="vote-grid">
        {vm.cards.map((c) => (
          <div key={c.id} className="vote-card">
            <div className="vote-img">
              {c.hasImg ? <div className="img-cover" style={{ backgroundImage: c.bg, transform: c.flipT }} /> : c.ph}
            </div>
            <div className="vote-body">
              <div className="vote-info">
                <div className="vote-label">{c.label}</div>
                <div className="muted-13">{c.name}</div>
              </div>
              <div className="vote-btns">
                <button type="button" className="vote-btn" onClick={c.onBest} aria-pressed={c.isBest} style={{ background: c.bestBg, color: c.bestFg, boxShadow: c.bestSh }}>
                  Best
                </button>
                <button type="button" className="vote-btn" onClick={c.onUnh} aria-pressed={c.isUnh} style={{ background: c.unhBg, color: c.unhFg, boxShadow: c.unhSh }}>
                  Unhinged
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
