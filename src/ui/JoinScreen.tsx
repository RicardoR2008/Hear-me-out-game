import type { ViewModel } from '../game/viewModel';
import { DayNight } from './common';

export function JoinScreen({ vm, toggle }: { vm: ViewModel['join']; toggle: ViewModel['toggle'] }) {
  return (
    <main className="join">
      <div className="join-toggle">
        <div className="pillbar">
          <DayNight toggle={toggle} />
        </div>
      </div>
      <div className="join-col">
        <div className="join-intro">
          <h1 className="join-title">
            Hear Me Out<span className="dot">.</span>
          </h1>
          <p className="join-lede">Everyone secretly picks their most questionable crush. Then you reveal them one by one, put them on the cake, and defend yourself.</p>
        </div>
        <div className="join-card">
          <label className="join-label">
            Nickname
            <input
              className="field field-name"
              value={vm.name}
              onChange={(e) => vm.onName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !vm.busy) {
                  e.preventDefault();
                  vm.enterName();
                }
              }}
              maxLength={16}
              placeholder="What should we call you?"
              autoComplete="nickname"
              enterKeyHint="go"
            />
          </label>
          <button type="button" className="btn btn-big btn-pink" onClick={vm.create} disabled={vm.busy} style={{ opacity: vm.busyOpacity }}>
            Create a room
          </button>
          <div className="join-or">
            <div />
            or join one
            <div />
          </div>
          <div className="join-code-row">
            <input
              className="field field-code"
              value={vm.codeInput}
              onChange={(e) => vm.onCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !vm.busy) {
                  e.preventDefault();
                  vm.join();
                }
              }}
              maxLength={200}
              placeholder="CODE"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button type="button" className="btn btn-plain btn-join" onClick={vm.join} disabled={vm.busy} style={{ opacity: vm.busyOpacity }}>
              Join
            </button>
          </div>
          {vm.note && (
            <div className="join-note" role="status">
              {vm.note}
            </div>
          )}
          {vm.err && (
            <div className="err" role="alert">
              {vm.err}
            </div>
          )}
          {vm.netNote && <div className="net-note">{vm.netNote}</div>}
        </div>
      </div>
    </main>
  );
}
