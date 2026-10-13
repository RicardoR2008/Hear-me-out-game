import '@fontsource/bowlby-one/400.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/400-italic.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/hanken-grotesk/800.css';
import './styles.css';

import { createRoot } from 'react-dom/client';
import { GameController, type GameEnv } from './game/controller';
import { probeImage } from './game/image';
import { createNet } from './net';
import { App } from './ui/App';
import { watchForUpdates } from './updateCheck';

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

const env: GameEnv = {
  createNet,
  storage,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => {
    if (id != null) window.clearTimeout(id);
  },
  probeImage,
};

const game = new GameController(env);
// An invite link (?room=ABCD) fills in the room code.
game.useInvite(new URLSearchParams(location.search).get('room'));
game.start();
watchForUpdates(new URL(import.meta.url).pathname.split('/').pop() || '', () => game.setState({ updateReady: true }));

// Drags, frosting lines and presenting keys work anywhere on the page.
window.addEventListener('pointermove', (e) => game.onPointerMove(e));
window.addEventListener('pointerup', () => game.onPointerUp());
window.addEventListener('pointercancel', () => game.onPointerUp());
window.addEventListener('keydown', (e) => game.onKeyDown(e));
window.addEventListener('paste', (e) => game.onPaste(e));

createRoot(document.getElementById('root')!).render(<App game={game} />);
