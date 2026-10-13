// Turns the controller's View into exactly what each screen displays.
// Pure apart from the handlers, which call back into the controller.
import { ACC, CHARS, FR, INK, INKC, LINE, MAXP, MINP, PENS, PL, REACTS, SP, STEPS, TOOLS, charEmoji } from './constants';
import type { GameController, ViewPlayer } from './controller';
import { cardWFor, effScale } from './geometry';
import type { CakePart, LabelPos, PickRec, ReactKey, ThemeMode, ToolKey } from './types';
import { cleanTheme, cssUrl, listJoin, milStamp, normCode, recipeLine } from './util';

const FAINT = 'var(--faint,#6E6272)';
const OK = 'var(--ok,#0F7A53)';
const CARD = 'var(--card,#FFFFFF)';
const SHADOW3 = '0 3px 0 var(--shadow,#1C1520)';

/** Look of a selectable chip (sponge, frosting, tools...). */
const sel = (on: boolean) => ({
  on,
  border: on ? LINE : 'var(--chip-line,#E3D2C2)',
  bg: on ? 'var(--soft,#FFE9D2)' : CARD,
  shadow: on ? SHADOW3 : 'none',
});

export interface ReadyRow {
  key: string;
  name: string;
  color: string;
  emoji: string;
  status: string;
  statusColor: string;
}

export interface FullPick extends PickRec {
  id: string;
  name: string;
  color: string;
  emoji: string;
  hasImg: boolean;
  bg: string;
  label: string;
  caption: string;
  flipT: string;
  ph: string;
  phLong: string;
  says: string;
}

export interface Pointerish {
  clientX: number;
  clientY: number;
  preventDefault(): void;
  stopPropagation(): void;
}

export function buildViewModel(g: GameController) {
  const s = g.view();
  const night = g.isNight();
  const pl: Record<string, ViewPlayer> = Object.fromEntries(s.players.map((p) => [p.id, p]));
  const EMO: Record<string, string> = Object.fromEntries(s.players.map((p) => [p.id, charEmoji(p.char)]));
  const nameOf = (id: string | undefined) => (id && pl[id] ? pl[id].name : '');
  const dec = s.screen === 'decorate',
    pen = s.tool === 'pen';
  const si = STEPS.findIndex((x) => x.key === s.screen);
  const me: PickRec = s.picks.me || ({} as PickRec);
  const hasTheme = !!s.cakeTheme;

  const full = (id: string): FullPick => {
    const p: PickRec = s.picks[id] || ({} as PickRec),
      o = pl[id] || ({} as ViewPlayer),
      // A pick saved without a name is "<owner>'s pick" for everyone (the keepsake says the same).
      label = p.label || (id === 'me' ? s.name : o.name || 'Someone') + "'s pick";
    return {
      ...p,
      id,
      name: id === 'me' ? 'You' : o.name,
      color: o.color,
      emoji: EMO[id] || '',
      hasImg: !!p.img,
      bg: p.img ? cssUrl(p.img) : 'none',
      label,
      caption: p.caption || '',
      flipT: p.flip ? 'scaleX(-1)' : 'none',
      ph: '[ ' + label + ' ]',
      phLong: '[ image of ' + label + ' ]',
      says: id === 'me' ? 'You say' : o.name + ' says',
    };
  };

  // ---- cake stage -----------------------------------------------------------
  let shown: string[] = [];
  if (s.screen === 'submit' && me.img) shown = ['me'];
  if (s.screen === 'reveal') shown = s.order.slice(0, s.idx + ((s.part || 0) >= 1 ? 1 : 0));
  if (s.screen === 'results') shown = s.order;
  const curId = s.order[s.idx] as string | undefined,
    clashIds = s.screen === 'submit' && !s.locked ? g.mineClashes(s) : [];
  const curParts = curId ? g.partsOf(curId) : [],
    partN = Math.min(s.part || 0, curParts.length),
    curDone = !!curId && partN >= curParts.length,
    mineUp = curId === 'me',
    hideName = s.screen === 'reveal' && partN < 2;
  const bw = cardWFor(s.pickN);

  const ghosts =
    s.screen === 'submit'
      ? s.players
          .filter((p) => p.id !== 'me' && s.picks[p.id])
          .map((p) => {
            const q = s.picks[p.id],
              st = q.stick || 11,
              sc = effScale(q, s.pickN),
              hit = clashIds.includes(p.id);
            return {
              id: p.id,
              name: p.name,
              emoji: EMO[p.id],
              color: p.color,
              left: q.x + '%',
              top: q.y + '%',
              rot: (q.rot || 0).toFixed(1),
              w: (bw * sc).toFixed(2) + 'cqw',
              stickPx: (st * sc).toFixed(1) + 'cqh',
              z: 40 + Math.round(q.y),
              op: q.moving ? 0.55 : 0.9,
              status: q.moving ? 'Placing…' : s.ready[p.id] ? '✓ Locked' : 'Spot set',
              border: hit ? '#FF3B3B' : p.color,
              fill: hit ? 'rgba(255,59,59,0.18)' : 'rgba(255,255,255,0.55)',
            };
          })
      : [];

  const items = shown.map((id) => {
    const f = full(id),
      drag = s.screen === 'submit' && id === 'me',
      cur = s.screen === 'reveal' && id === curId,
      st = f.stick || 11,
      sc = effScale(f, s.pickN),
      rawLabel = (s.picks[id] || {}).label || '',
      tagged = !(cur && hideName) && f.hasImg && !!rawLabel;
    return {
      ...f,
      label: cur && hideName ? '???' : f.label,
      left: f.x + '%',
      top: f.y + '%',
      rot: (f.rot || 0).toFixed(1),
      w: (bw * sc).toFixed(2) + 'cqw',
      stickPx: (st * sc).toFixed(1) + 'cqh',
      editable: drag,
      tag: rawLabel,
      tagAbove: tagged && f.labelPos === 'above',
      tagBelow: tagged && f.labelPos !== 'above',
      z: cur || drag ? 1000 : Math.round(f.y * 10),
      cursor: drag ? 'grab' : 'default',
      shadow:
        drag && clashIds.length
          ? '0 0 0 4px #FF3B3B, 0 8px 20px rgba(28,21,32,0.24)'
          : cur
            ? '0 0 0 4px ' + ACC + ', 0 12px 28px rgba(28,21,32,0.32)'
            : '0 8px 20px rgba(28,21,32,0.24)',
      onDown: drag
        ? (e: Pointerish) => {
            e.preventDefault();
            e.stopPropagation();
            g.grabMine(e, f);
          }
        : undefined,
      onFlip: drag
        ? (e: Pointerish) => {
            e.preventDefault();
            e.stopPropagation();
            g.flipMine();
          }
        : undefined,
      onRotate: drag
        ? (e: Pointerish) => {
            e.preventDefault();
            e.stopPropagation();
            g.rotateMine(e, f);
          }
        : undefined,
      onResize: drag
        ? (e: Pointerish) => {
            e.preventDefault();
            e.stopPropagation();
            g.resizeMine(e, f, sc);
          }
        : undefined,
    };
  });

  const dr = s.decoReady || {},
    meDone = !!dr.me;
  const toppings = s.toppings.map((t) => {
    const mine = dec && !pen && !meDone && t.by === 'me';
    return {
      id: t.id,
      type: t.type,
      left: t.x + '%',
      top: t.y + '%',
      z: 100 + Math.round(t.y * 2),
      stripe: t.stripe,
      tf:
        t.type === 'candle'
          ? 'translate(-50%,-100%)'
          : t.type === 'cherry'
            ? 'translate(-50%,-85%)'
            : 'translate(-50%,-50%) rotate(' + (t.type === 'sprinkles' ? (t.rot || 0).toFixed(0) : 0) + 'deg)',
      pe: mine ? 'auto' : 'none',
      cursor: mine ? 'pointer' : 'default',
      title: mine ? 'Click to remove' : '',
      onDown: mine
        ? (e: { stopPropagation(): void }) => {
            e.stopPropagation();
            g.removeTopping(t.id);
          }
        : undefined,
    };
  });

  const waitP = s.players.filter((p) => p.online && !dr[p.id]);
  const decoWaitText = !waitP.length
    ? 'Everyone is done. Picking starts in ' + (s.decoGo || 3) + '…'
    : waitP.length <= 3
      ? 'You are done. Waiting for ' + listJoin(waitP.map((p) => p.name)) + '.'
      : 'You are done. Waiting for ' + waitP.length + ' more.';

  const cakeCaption = dec
    ? meDone
      ? 'You are done. Tap Keep decorating to change anything.'
      : s.hint || (pen ? 'Draw on the cake with the frosting pen.' : 'Click the cake to add toppings. Click one of yours to remove it.')
    : s.screen === 'submit'
      ? clashIds.length
        ? 'Too close to ' + clashIds.map(nameOf).join(' and ') + "'s spot. Let go and it slides to a free spot."
        : s.locked
          ? 'Locked in. Dashed outlines show where everyone else is putting theirs.'
          : me.img
            ? (s.hint === 'Moved your pick to a free spot.' ? s.hint + ' ' : '') + "Drag to move it. Dashed outlines are everyone else's spots, live."
            : 'Dashed outlines show where everyone else is putting their pick, live.'
      : s.screen === 'reveal'
        ? 'Picks land on the cake as they are revealed.'
        : '';

  const cake = {
    spec: s.cake,
    strokes: s.strokes,
    toppings,
    ghosts,
    items,
    stageAspect: dec ? '1/0.72' : '1/1.2',
    stageOverflow: dec ? 'hidden' : 'visible',
    cursor: dec && !meDone ? (pen ? 'crosshair' : 'pointer') : 'default',
    onDown: (e: { clientX: number; clientY: number; preventDefault(): void }) => g.onCakeDown(e),
    caption: cakeCaption,
    isResults: s.screen === 'results',
    hasTheme,
    themeLine: 'Theme: ' + s.cakeTheme,
    stamp: s.finishedAt ? milStamp(s.finishedAt) : '',
    recipe: recipeLine(s.cake, s.toppings.length, s.strokes.length),
    // Everyone who played this round: still here, or had a pick revealed. Not someone who left before taking part.
    credits: 'Decorated by ' + listJoin(s.players.filter((p) => p.online || s.order.includes(p.id)).map((p) => (p.id === 'me' ? s.name : p.name))),
  };

  // ---- side panels ----------------------------------------------------------
  const byNote = (k: CakePart) => {
    const b = s.cakeBy[k];
    return b ? (b === 'me' ? 'Picked by you' : 'Picked by ' + nameOf(b)) : '';
  };
  const grp = (key: CakePart, title: string, M: Record<string, { label: string; c: string }>) => ({
    title,
    note: byNote(key),
    opts: Object.entries(M).map(([k, v]) => ({ key: k, label: v.label, color: v.c, ...sel(s.cake[key] === k), onClick: () => g.chooseCake(key, k) })),
  });
  const swatchGroups = [
    grp('sponge', 'Sponge', SP),
    grp('frosting', 'Frosting', FR),
    grp('plate', 'Plate', PL),
    {
      title: 'Add to the cake',
      note: '',
      opts: TOOLS.map(([k, l, c]) => ({ key: k, label: l, color: k === 'pen' ? PENS[s.pen][1] : c, ...sel(s.tool === k), onClick: () => g.setTool(k as ToolKey) })),
    },
  ];
  if (pen)
    swatchGroups.push({
      title: 'Pen color',
      note: '',
      opts: Object.entries(PENS).map(([k, v]) => ({ key: k, label: v[0], color: v[1], ...sel(s.pen === k), onClick: () => g.setPen(k as keyof typeof PENS) })),
    });

  const row = (p: ViewPlayer, done: boolean, busy: string, doneText: string, away = 'Away'): ReadyRow => ({
    key: p.uid,
    name: p.id === 'me' ? p.name + ' (you)' : p.name,
    color: p.color,
    emoji: EMO[p.id],
    status: !p.online ? away : done ? doneText : busy,
    statusColor: done ? OK : FAINT,
  });

  const canUndo = g.canUndo();
  const decorate = {
    hasTheme,
    cakeTheme: s.cakeTheme,
    swatchGroups,
    toolsOpacity: meDone ? 0.45 : 1,
    toolsPE: meDone ? 'none' : 'auto',
    toolsOff: meDone,
    activity: s.log,
    readyList: s.players.map((p) => row(p, !!dr[p.id], 'Decorating…', 'Ready')),
    meDone,
    undo: () => g.undo(),
    cantUndo: !canUndo,
    undoOpacity: canUndo ? 1 : 0.4,
    finish: () => g.setDecoReady(true),
    keepDecorating: () => g.setDecoReady(false),
    waitText: decoWaitText,
  };

  // Pick screen: lock in, then say you're ready; the reveal starts when everyone has.
  const lockedIn = (p: ViewPlayer) => (p.id === 'me' ? s.locked : !!s.ready[p.id]);
  const revealReady = (p: ViewPlayer) => lockedIn(p) && !!s.revealOk[p.id];
  const okMe = !!s.revealOk.me && s.locked;
  const notReadyYet = s.players.filter((p) => p.online && p.id !== 'me' && !revealReady(p));
  const submit = {
    hasTheme,
    cakeTheme: s.cakeTheme,
    locked: s.locked,
    hasMyImg: !!me.img,
    myBg: me.img ? cssUrl(me.img) : 'none',
    myFlipT: me.flip ? 'scaleX(-1)' : 'none',
    dropBorder: s.dragOver ? ACC : LINE,
    setDragOver: (on: boolean) => {
      if (g.state.dragOver !== on) g.setState({ dragOver: on });
    },
    onDropData: (dt: DataTransfer) => {
      g.setState({ dragOver: false });
      const f = dt.files[0];
      if (f) g.readFile(f);
      else {
        const u = dt.getData('text/uri-list') || dt.getData('text');
        if (u) g.setImg(u.trim());
      }
    },
    onFile: (f: File | undefined) => g.readFile(f),
    linkVal: s.linkVal,
    onLink: (v: string) => g.setState({ linkVal: v }),
    useLink: () => g.useLink(),
    imgErr: s.imgErr,
    labelVal: me.label || '',
    onLabel: (v: string) => g.updMine({ label: v }),
    labelPosOpts: (
      [
        ['above', '↑ Above'],
        ['below', '↓ Below'],
      ] as [LabelPos, string][]
    ).map(([k, l]) => {
      const on = (me.labelPos || 'below') === k;
      return { key: k, label: l, on, bg: on ? '#FFD43B' : 'transparent', fg: on ? INKC : INK, onClick: () => g.updMine({ labelPos: k }) };
    }),
    fileErr: s.fileErr,
    captionVal: me.caption || '',
    onCaption: (v: string) => g.updMine({ caption: v }),
    cantLock: !me.img || s.imgErr,
    lockOpacity: !me.img || s.imgErr ? 0.4 : 1,
    lockIn: () => g.lockIn(),
    unlock: () => g.unlock(),
    sizeVal: Math.round((me.scale || 1) * 100),
    onSize: (v: number) => g.updMine({ scale: v / 100 }),
    rotVal: Math.round(me.rot || 0),
    onRot: (v: number) => g.updMine({ rot: v }),
    flipMine: () => g.updMine({ flip: !me.flip }),
    readyList: s.players.map((p) => row(p, revealReady(p), lockedIn(p) ? 'Locked in' : 'Picking…', 'Ready')),
    revealOkMe: okMe,
    cantOkReveal: !s.locked,
    okRevealOpacity: s.locked ? 1 : 0.35,
    okReveal: () => g.setRevealOk(true),
    notYet: () => g.setRevealOk(false),
    revealWaitText: !notReadyYet.length
      ? 'Everyone is ready. The reveal is starting…'
      : notReadyYet.length <= 3
        ? 'You are ready. Waiting for ' + listJoin(notReadyYet.map((p) => p.name)) + '.'
        : 'You are ready. Waiting for ' + notReadyYet.length + ' more.',
  };

  const r = (curId && s.reacts[curId]) || {};
  const cur = curId ? full(curId) : null;
  const curName = nameOf(curId);
  const canNext = g.canNext(s);
  const reveal = {
    label: 'Reveal ' + (s.idx + 1) + ' of ' + s.order.length,
    cur,
    partDots: curParts.map((_, i) => i < partN),
    partsTitle: partN + ' of ' + curParts.length + ' parts shown',
    presenting: mineUp && !curDone,
    otherPresenting: !!curId && !mineUp && !curDone,
    showNext: () => g.presentNext(),
    showNextLabel: (() => {
      const k = curParts[partN];
      return k === 'img' ? 'Show the picture' : k === 'label' ? 'Show the name' : partN === 2 ? 'Show my defense' : 'Next line';
    })(),
    mysteryText: mineUp ? 'Your turn. Show them when you are ready.' : curName + ' is about to show you…',
    presenterText: curId && pl[curId] && pl[curId].online === false ? curName + ' left. The host is showing their pick…' : curName + ' is presenting…',
    imgShown: partN >= 1,
    labelShown: partN >= 2,
    labelGhostW: Math.max(30, Math.min(90, String(cur ? cur.label : '').length * 4)) + '%',
    curPh: partN >= 2 ? (cur ? cur.phLong : '') : '[ image of ??? ]',
    lines: curParts.slice(2).map((t, i, a) => ({
      text: (i === 0 ? '“' : '') + t + (i === a.length - 1 ? '”' : ''),
      shown: partN >= 3 + i,
      ghostW: Math.max(28, Math.min(100, Math.round(t.length * 1.6))) + '%',
    })),
    canReact: partN >= 1,
    reactBtns: REACTS.map(([k, l, em]) => ({
      key: k,
      label: l,
      emoji: em,
      count: r[k] || 0,
      onClick: () => {
        const t = g.view();
        if (t.screen === 'reveal' && !t.curtain && (t.part || 0) >= 1) g.react(k as ReactKey);
      },
    })),
    floaters: (s.floaters || [])
      .filter((f) => f.pick === curId)
      .map((f) => ({ ...f, emoji: (REACTS.find((q) => q[0] === f.k) || ['', '', ''])[2], who: f.by === 'me' ? null : nameOf(f.by) || null })),
    canNextBtn: curDone && canNext,
    nextWait: curDone && !canNext,
    nextWaitText: 'Waiting for ' + (curName || 'them') + ' to continue…',
    nextLabel: s.idx < s.order.length - 1 ? 'Next reveal' : 'Go to voting',
    next: () => g.nextReveal(),
  };

  const award = (c: 'best' | 'unh') => {
    if (!s.results || !s.results[c]) return null;
    const [id, v] = s.results[c]!,
      tie = c === 'best' ? s.results.bestTie : s.results.unhTie;
    const f = full(id);
    return {
      ...f,
      key: c,
      title: c === 'best' ? 'Best pick' : 'Most unhinged',
      sub: (id === 'me' ? 'Your pick' : f.name + "'s pick") + ' · ' + v + (v === 1 ? ' vote' : ' votes') + (tie ? ' · Tie broken at random' : ''),
    };
  };
  const winners = [award('best'), award('unh')].filter((w) => w !== null);
  const results = {
    winners,
    noWinners: s.screen === 'results' && !winners.length ? 'No votes this round, so no awards. The cake still looks great.' : '',
    saveKeepsake: () => void g.exportKeepsake(),
    keepsakeBusy: s.keepsake === 'working',
    keepsakeMsg:
      s.keepsake === 'working'
        ? 'Packing up the cake…'
        : s.keepsake === 'done'
          ? 'Saved ' + s.keepsakeName + '. It opens in any browser.'
          : s.keepsake === 'error'
            ? 'Could not save the keepsake. Try again.'
            : '',
    playAgain: () => g.playAgain(),
  };

  const votesIn = g.state.room?.votes || {};
  // Someone whose own pick is the only one shown has nothing to vote on, so nobody waits for them.
  const hasCards = (p: ViewPlayer) => s.order.some((id) => id !== p.id);
  const waitingVoters = s.players.filter((p) => p.online && p.id !== 'me' && !votesIn[p.uid] && hasCards(p)).map((p) => p.name);
  // Once my votes are in, show what I sent (also after a refresh), and the buttons stop changing it.
  const sent = (s.uid && votesIn[s.uid]) || null,
    myBest = sent ? (sent.best === s.uid ? 'me' : sent.best) : s.votes.best,
    myUnh = sent ? (sent.unh === s.uid ? 'me' : sent.unh) : s.votes.unh;
  const voteCards = s.order
    .filter((id) => id !== 'me')
    .map((id) => {
      const f = full(id),
        b = myBest === id,
        u = myUnh === id;
      return {
        ...f,
        isBest: b,
        isUnh: u,
        bestBg: b ? '#FFD43B' : CARD,
        bestFg: b ? INKC : INK,
        bestSh: b ? SHADOW3 : 'none',
        unhBg: u ? ACC : CARD,
        unhFg: u ? INKC : INK,
        unhSh: u ? SHADOW3 : 'none',
        locked: s.hasVoted,
        onBest: () => g.chooseVote('best', id),
        onUnh: () => g.chooseVote('unh', id),
      };
    });
  const vote = {
    cards: voteCards,
    nothingToVote: !voteCards.length,
    nothingText: 'The only pick shown was yours, so there is nothing for you to vote on. The results are on the way…',
    cantVote: s.hasVoted || !(s.votes.best && s.votes.unh),
    voteOpacity: !s.hasVoted && s.votes.best && s.votes.unh ? 1 : 0.4,
    hasVoted: s.hasVoted,
    waitText: 'Votes in. Waiting for ' + (waitingVoters.length ? listJoin(waitingVoters) : 'the results') + '…',
    submit: () => g.submitVotes(),
  };

  // ---- lobby & theme ----------------------------------------------------------
  const online = s.players.filter((p) => p.online).length;
  const agreedOk = !!cleanTheme(s.themeAgreed);
  const cantStart = !s.isHost || online < MINP || (s.themeMode === 'agreed' && !agreedOk);
  const lobby = {
    code: s.code,
    isHost: s.isHost,
    chars: CHARS.map((c, i) => {
      // Players who left don't hold their character: anyone can take it.
      const own = s.players.find((p) => p.char === i && (p.online || p.id === 'me')),
        mine = !!own && own.id === 'me';
      return {
        key: c.n,
        name: c.n,
        emoji: c.e,
        glow: c.g,
        frame: own ? own.color : 'transparent',
        tag: own ? (mine ? 'You' : own.name) : '',
        tagBg: own ? own.color : 'transparent',
        locked: !!own && !mine,
        cursor: own ? (mine ? 'default' : 'not-allowed') : 'pointer',
        title: own ? (mine ? 'You are ' + c.n : own.name + ' is ' + c.n) : 'Play as ' + c.n,
        onPick: () => g.pickChar(i),
      };
    }),
    themeModeOpts: (
      [
        ['vote', 'Everyone suggests, then votes'],
        ['agreed', 'We already agreed'],
      ] as [ThemeMode, string][]
    ).map(([k, l]) => {
      const on = s.themeMode === k;
      return {
        key: k,
        label: l,
        on,
        bg: on ? '#FF8A5C' : 'transparent',
        fg: on ? INKC : INK,
        disabled: !s.isHost,
        title: s.isHost ? '' : 'The host picks this',
        onClick: () => g.setThemeMode(k),
      };
    }),
    isAgreed: s.themeMode === 'agreed',
    themeAgreed: s.themeAgreed,
    onThemeAgreed: (v: string) => g.setThemeAgreed(v),
    themeModeNote:
      s.themeMode === 'agreed'
        ? agreedOk
          ? 'Everyone decorates and picks for this theme.'
          : 'Type the theme you all agreed on to start.'
        : 'Everyone suggests a theme, then you all vote.',
    start: () => g.startGame(),
    cantStart,
    startOpacity: cantStart ? 0.4 : 1,
    // Who is host is shown big at the top of the lobby (role); this line under the Start button is only a reminder.
    note:
      (online < MINP ? 'Need at least ' + MINP + ' players. Share the code ' + s.code + '.' : online + ' of ' + MAXP + ' players.') +
      (s.isHost ? '' : ' Only the host can start the game.'),
    role: s.isHost
      ? { host: true, icon: '👑', title: 'You are the host', text: 'You start the game when everyone is here.' }
      : {
          host: false,
          icon: EMO.me || '🙂',
          title: 'You are a player',
          text: (s.hostName ? s.hostName + ' is the host and' : 'The host') + ' will start the game.',
        },
  };

  const isTheme = s.screen === 'theme';
  const themeStep = {
    suggest: isTheme && s.themeStage === 'suggest',
    vote: isTheme && s.themeStage === 'vote',
    result: isTheme && s.themeStage === 'result',
    showStatus: isTheme && s.themeStage !== 'result',
    themeIn: s.themeIn,
    onThemeIn: (v: string) => g.setState({ themeIn: String(v).slice(0, 40) }),
    submitSug: () => g.submitSug(),
    cantSug: !cleanTheme(s.themeIn),
    mySug: s.themeSugs.me || '',
    changeSug: () => g.changeSug(),
    status: s.players.map((p) => {
      const v = s.themeStage === 'vote',
        done = v ? p.id in s.themeVotes : !!s.themeSugs[p.id];
      return row(p, done, v ? 'Voting…' : 'Thinking…', v ? 'Voted' : 'Suggested');
    }),
    optCards: (isTheme ? g.themeOpts(s) : []).map((o) => {
      const mine = o.by.includes('me'),
        on = s.themeVotes.me === o.key;
      return { key: o.key, text: o.text, mine, voteLabel: on ? 'Voted ✓' : 'Vote', bg: on ? '#FF8A5C' : CARD, fg: on ? INKC : INK, onVote: () => g.castThemeVote(o.key) };
    }),
    winner: s.themeResult ? s.themeResult.text : '',
    goText: 'Decorating starts in ' + (s.themeGo || 3) + '…',
    winNote: (() => {
      const R = s.themeResult;
      if (!R) return '';
      if (R.consensus) return 'Everyone suggested it.';
      const who = listJoin(R.by.map((id) => (id === 'me' ? 'you' : nameOf(id))));
      return 'Suggested by ' + who + ' · ' + R.votes + (R.votes === 1 ? ' vote' : ' votes') + (R.tie ? ' · Tie broken at random' : '');
    })(),
  };

  // ---- chrome -----------------------------------------------------------------
  const toggle = {
    night,
    setDay: () => g.setTheme('day'),
    setNight: () => g.setTheme('night'),
    dayBg: night ? 'transparent' : '#FFD43B',
    dayFg: night ? FAINT : INKC,
    nightBg: night ? '#B79CFF' : 'transparent',
    nightFg: night ? INKC : FAINT,
  };
  const header = {
    roomLabel: 'Room ' + s.code,
    players: s.players.map((p) => ({
      key: p.uid,
      name: p.name,
      color: p.color,
      emoji: EMO[p.id],
      plateBg: p.id === 'me' ? '#FFD43B' : '#DCD6E0',
      op: p.online ? 1 : 0.35,
      /** The host wears a crown in the header on every screen. */
      host: p.host,
      title: p.name + (p.host ? ' (host)' : '') + (p.online ? '' : ' (away)'),
    })),
    steps: STEPS.map((x, i) => ({
      key: x.key,
      label: x.label,
      bg: i === si ? x.color : 'transparent',
      bd: i === si ? LINE : 'transparent',
      fg: i === si ? INKC : i < si ? INK : FAINT,
    })),
    leave: () => g.leave(''),
  };
  const join = {
    name: s.name,
    onName: (v: string) => g.setState({ name: v, err: '' }),
    codeInput: s.codeInput,
    // Typing, or pasting "Room ABCD" or a whole invite link, all leave just the 4-letter code.
    onCode: (v: string) => g.setState({ codeInput: normCode(v), err: '' }),
    create: () => void g.create(),
    join: () => void g.joinRoom(),
    /** Enter in the nickname box: join if a whole code is typed in, otherwise make a room. */
    enterName: () => void (s.codeInput.length === 4 ? g.joinRoom() : g.create()),
    busy: s.busy,
    busyOpacity: s.busy || !s.uid ? 0.6 : 1,
    err: s.err,
    note: s.joinNote,
    netNote: s.netNote,
  };
  const banners = {
    offline: s.offline ? 'Connection lost. Trying to reconnect…' : '',
    update: s.updateReady,
    updateText: 'A new version of the game is out.',
    refresh: () => window.location.reload(),
  };

  return {
    screen: s.screen,
    code: s.code,
    curtain: s.curtain,
    banners,
    toggle,
    header,
    join,
    lobby,
    themeStep,
    cake,
    decorate,
    submit,
    reveal,
    results,
    vote,
  };
}

export type ViewModel = ReturnType<typeof buildViewModel>;
export type CakeVM = ViewModel['cake'];
export type CakeItemVM = CakeVM['items'][number];
export type GhostVM = CakeVM['ghosts'][number];
export type ToppingVM = CakeVM['toppings'][number];
