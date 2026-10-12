import { useRef } from 'react';
import type { ViewModel } from '../../game/viewModel';
import { Banner, ReadyPanel, ThemeChip } from '../common';

export function SubmitPanel({ vm }: { vm: ViewModel['submit'] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const openFile = () => fileRef.current?.click();
  return (
    <div className="stack-20">
      <div className="head">
        <h2 className="head-title">Pick your hear me out</h2>
        <div className="head-sub">Only you can see this until the reveal. Drag it onto the cake wherever you want it.</div>
        {vm.hasTheme && <ThemeChip theme={vm.cakeTheme} />}
      </div>
      {!vm.locked && (
        <div className="stack-14">
          <div
            className="drop"
            role="button"
            tabIndex={0}
            aria-label="Upload a picture"
            onClick={openFile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFile();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              vm.setDragOver(true);
            }}
            onDragLeave={() => vm.setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              vm.onDropData(e.dataTransfer);
            }}
            style={{ borderColor: vm.dropBorder }}
          >
            {vm.hasMyImg ? (
              <div className="drop-preview" style={{ backgroundImage: vm.myBg, transform: vm.myFlipT }} />
            ) : (
              <div className="drop-prompt">
                <div className="drop-title">Drop an image, click to upload</div>
                <div className="muted-14">or paste one anywhere with Ctrl/⌘ + V</div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              vm.onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="row-8">
            <input
              className="field field-15"
              value={vm.linkVal}
              onChange={(e) => vm.onLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  vm.useLink();
                }
              }}
              placeholder="…or paste an image link"
              aria-label="Image link"
              inputMode="url"
            />
            <button type="button" className="btn btn-plain btn-link" onClick={vm.useLink}>
              Use link
            </button>
          </div>
          {vm.imgErr && (
            <div className="err" role="alert">
              That image didn't load. Try another link or upload the file.
            </div>
          )}
          <div className="row-8 stretch">
            <input
              className="field field-15"
              value={vm.labelVal}
              onChange={(e) => vm.onLabel(e.target.value)}
              maxLength={40}
              placeholder="Who is it?"
              aria-label="Who is it?"
            />
            <div className="seg seg-label" title="Where the name shows on the cake">
              {vm.labelPosOpts.map((lp) => (
                <button key={lp.key} type="button" className="seg-opt seg-pos" onClick={lp.onClick} aria-pressed={lp.on} style={{ background: lp.bg, color: lp.fg }}>
                  {lp.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="field field-15 defense"
            value={vm.captionVal}
            onChange={(e) => vm.onCaption(e.target.value)}
            maxLength={280}
            rows={4}
            placeholder="Your defense (optional)"
            aria-label="Your defense (optional)"
          />
          <button type="button" className="btn btn-big btn-pink" onClick={vm.lockIn} disabled={vm.cantLock} style={{ opacity: vm.lockOpacity }}>
            Lock it in
          </button>
        </div>
      )}
      {vm.hasMyImg && (
        <div className="adjust">
          <span className="adjust-k">Size</span>
          <input type="range" min={50} max={180} step={1} value={vm.sizeVal} onChange={(e) => vm.onSize(+e.target.value)} aria-label="Size" />
          <button type="button" className="btn btn-plain btn-flip" onClick={vm.flipMine}>
            Flip ⇄
          </button>
          <span className="adjust-k">Rotate</span>
          <input type="range" min={-90} max={90} step={1} value={vm.rotVal} onChange={(e) => vm.onRot(+e.target.value)} aria-label="Rotate" />
        </div>
      )}
      {vm.locked && (
        <Banner action="Undo lock-in" onAction={vm.unlock}>
          Locked in. You can still move, resize, rotate, or flip it.
        </Banner>
      )}
      <ReadyPanel rows={vm.readyList} />
      <button type="button" className="btn btn-big btn-blue" onClick={vm.startReveal} disabled={vm.cantReveal} style={{ opacity: vm.revealOpacity }}>
        Start the reveal
      </button>
    </div>
  );
}
