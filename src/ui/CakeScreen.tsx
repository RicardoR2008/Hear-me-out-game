import { useCallback } from 'react';
import type { GameController } from '../game/controller';
import type { ViewModel } from '../game/viewModel';
import { CakeArt, DrawLayer } from './cake/CakeArt';
import { CakeItem, Ghost } from './cake/PickCard';
import { Topping } from './cake/Topping';
import { DecoratePanel } from './panels/DecoratePanel';
import { ResultsPanel } from './panels/ResultsPanel';
import { RevealPanel } from './panels/RevealPanel';
import { SubmitPanel } from './panels/SubmitPanel';

/** Decorate, pick, reveal and results: the cake on the left, the step's controls on the right. */
export function CakeScreen({ game, vm }: { game: GameController; vm: ViewModel }) {
  const c = vm.cake,
    s = vm.screen;
  const cakeRef = useCallback(
    (el: HTMLDivElement | null) => {
      game.cakeEl = el;
    },
    [game],
  );
  return (
    <main className="cake-layout">
      <div className="cake-col">
        {/* The stage and everything inside it is styled inline: the keepsake copies it as-is. */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 640,
            aspectRatio: c.stageAspect,
            margin: '0 auto',
            overflow: c.stageOverflow as 'hidden' | 'visible',
          }}
        >
          <div
            ref={cakeRef}
            onPointerDown={c.onDown}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              aspectRatio: '1/1.05',
              containerType: 'size',
              userSelect: 'none',
              touchAction: s === 'decorate' ? 'none' : 'manipulation',
              cursor: c.cursor,
            }}
          >
            <CakeArt cake={c.spec} />
            <DrawLayer strokes={c.strokes} />
            {c.toppings.map((t) => (
              <Topping key={t.id} t={t} />
            ))}
            {c.ghosts.map((g) => (
              <Ghost key={g.id} g={g} />
            ))}
            {c.items.map((it) => (
              <CakeItem key={it.id} it={it} />
            ))}
          </div>
        </div>
        {c.isResults ? (
          <div className="plaque">
            <div className="plaque-badge">Final cake</div>
            {c.hasTheme && <div className="plaque-theme">{c.themeLine}</div>}
            {c.stamp && <div className="plaque-stamp">{c.stamp}</div>}
            <div className="plaque-recipe">{c.recipe}</div>
            <div className="plaque-credits">{c.credits}</div>
          </div>
        ) : (
          <div className="cake-caption" aria-live="polite">
            {c.caption}
          </div>
        )}
      </div>
      <div className="side-col">
        {s === 'decorate' && <DecoratePanel vm={vm.decorate} />}
        {s === 'submit' && <SubmitPanel vm={vm.submit} />}
        {s === 'reveal' && <RevealPanel vm={vm.reveal} />}
        {s === 'results' && <ResultsPanel vm={vm.results} />}
      </div>
    </main>
  );
}
