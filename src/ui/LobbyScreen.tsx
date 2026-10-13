import { useEffect, useState } from 'react';
import type { ViewModel } from '../game/viewModel';

/** Link that opens the game with this room's code already filled in. */
export const inviteLink = (code: string) => location.origin + location.pathname + '?room=' + code;

/** Phones get the share sheet (Messages, WhatsApp…); computers copy the link. */
const canShare = () => typeof navigator !== 'undefined' && !!navigator.share && !!window.matchMedia?.('(pointer: coarse)').matches;

function InviteButton({ code }: { code: string }) {
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState(false);
  const link = inviteLink(code);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 2500);
    return () => clearTimeout(t);
  }, [msg]);
  const share = async () => {
    try {
      if (canShare()) {
        await navigator.share({ title: 'Hear Me Out', text: 'Join my Hear Me Out game! Room ' + code, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setManual(false);
      setMsg('Link copied! Paste it to your friends.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // closed the share sheet
      setManual(true); // couldn't copy: show the link so it can be copied by hand
    }
  };
  return (
    <div className="invite">
      <button type="button" className="btn btn-plain btn-invite" onClick={share}>
        {canShare() ? 'Share invite link' : 'Copy invite link'}
      </button>
      {msg && (
        <div className="invite-msg" role="status">
          {msg}
        </div>
      )}
      {manual && <input className="field invite-link" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />}
    </div>
  );
}

export function LobbyScreen({ vm }: { vm: ViewModel['lobby'] }) {
  return (
    <main className="lobby">
      {/* First thing on the page: are you the host or a player? */}
      <div className={'role-card ' + (vm.role.host ? 'role-host' : 'role-player')} role="status">
        <span className="role-icon" aria-hidden="true">
          {vm.role.icon}
        </span>
        <div className="role-words">
          <div className="role-title">{vm.role.title}</div>
          <div className="role-text">{vm.role.text}</div>
        </div>
      </div>
      <div className="lobby-code-wrap">
        <div className="lobby-share">Share this code with your friends</div>
        <div className="lobby-code">{vm.code}</div>
        <InviteButton code={vm.code} />
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
              disabled={m.disabled}
              title={m.title || undefined}
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
