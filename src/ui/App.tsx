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
      {vm.curtain && <Curtain curtain={vm.curtain} />}
    </div>
  );
}
