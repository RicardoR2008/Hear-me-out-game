import { useEffect, useSyncExternalStore } from 'react';
import type { GameController } from '../game/controller';
import { buildViewModel } from '../game/viewModel';
import { CakeScreen } from './CakeScreen';
import { Curtain } from './Curtain';
import { Header } from './Header';
import { JoinScreen } from './JoinScreen';
import { LobbyScreen } from './LobbyScreen';
import { ThemeScreen } from './ThemeScreen';
import { VoteScreen } from './VoteScreen';

const CAKE_SCREENS = ['decorate', 'submit', 'reveal', 'results'];

export function App({ game }: { game: GameController }) {
  useSyncExternalStore(game.subscribe, game.getVersion);
  const vm = buildViewModel(game);
  const night = vm.toggle.night;

  useEffect(() => {
    const root = document.documentElement;
    if (night) root.dataset.theme = 'night';
    else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', night ? '#15101B' : '#FFF6E9');
  }, [night]);

  const s = vm.screen;
  // A new step starts at its top, with its title, the step bar and the host's crown in view,
  // not wherever the last step was scrolled to (on a phone that is often far down the page).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [s]);

  return (
    <div className="app">
      {s !== 'join' && <Header vm={vm.header} toggle={vm.toggle} />}
      {s === 'join' && <JoinScreen vm={vm.join} toggle={vm.toggle} />}
      {s === 'connecting' && (
        <main className="connecting" aria-live="polite">
          Joining room {vm.code}…
        </main>
      )}
      {s === 'lobby' && <LobbyScreen vm={vm.lobby} />}
      {s === 'theme' && <ThemeScreen vm={vm.themeStep} />}
      {CAKE_SCREENS.includes(s) && <CakeScreen game={game} vm={vm} />}
      {s === 'vote' && <VoteScreen vm={vm.vote} />}
      {(vm.banners.offline || vm.banners.update) && (
        <div className="sys-banners">
          {vm.banners.offline && (
            <div className="sys-banner sys-offline" role="status">
              {vm.banners.offline}
            </div>
          )}
          {vm.banners.update && (
            <div className="sys-banner sys-update" role="status">
              <span>{vm.banners.updateText}</span>
              <button type="button" className="chip-btn" onClick={vm.banners.refresh}>
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
      {vm.curtain && <Curtain curtain={vm.curtain} />}
    </div>
  );
}
