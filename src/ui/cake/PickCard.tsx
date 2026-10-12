// Picks standing on the cake on sticks, and the dashed outlines of where others are putting theirs.
// Styled inline on purpose: the keepsake export copies this markup into a standalone page.
import type { CSSProperties } from 'react';
import type { CakeItemVM, GhostVM } from '../../game/viewModel';

const NAME_PILL: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  marginTop: -10,
  fontFamily: "'Hanken Grotesk',sans-serif",
  fontWeight: 800,
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 999,
  color: '#1C1520',
  border: '2px solid #1C1520',
  whiteSpace: 'nowrap',
};

const TAG: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'max-content',
  maxWidth: '170%',
  padding: '4px 9px',
  borderRadius: 7,
  background: '#fff',
  border: '2px solid #1C1520',
  boxShadow: '0 2px 0 #1C1520',
  fontFamily: "'Hanken Grotesk',sans-serif",
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.2,
  textAlign: 'center',
  textWrap: 'balance',
  color: '#1C1520',
};

const HANDLE: CSSProperties = {
  position: 'absolute',
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '2px solid #1C1520',
  zIndex: 3,
  boxShadow: '0 2px 0 #1C1520',
  touchAction: 'none',
};
const HANDLE_ICON: CSSProperties = {
  ...HANDLE,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  lineHeight: 1,
  color: '#1C1520',
};

export function CakeItem({ it }: { it: CakeItemVM }) {
  return (
    <div
      onPointerDown={it.onDown}
      style={{
        position: 'absolute',
        left: it.left,
        top: it.top,
        width: it.w,
        transform: `translate(-50%,-100%) rotate(${it.rot}deg)`,
        transformOrigin: '50% 100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: it.cursor,
        zIndex: it.z,
        animation: 'hmoCardDrop 620ms ease-out both',
        touchAction: it.editable ? 'none' : undefined,
      }}
    >
      {it.tagAbove && <div style={{ ...TAG, marginBottom: 5 }}>{it.tag}</div>}
      <div style={{ position: 'relative', width: '100%' }}>
        {it.editable && (
          <>
            <div onPointerDown={it.onFlip} title="Flip left to right" style={{ ...HANDLE_ICON, left: -11, top: -11, fontSize: 14, cursor: 'pointer' }}>
              ⇄
            </div>
            <div onPointerDown={it.onResize} title="Drag to resize" style={{ ...HANDLE, right: -11, top: -11, background: '#FF5FA2', cursor: 'nesw-resize' }} />
            <div onPointerDown={it.onRotate} title="Drag to rotate" style={{ ...HANDLE_ICON, right: -11, bottom: -11, fontSize: 15, cursor: 'grab' }}>
              ↻
            </div>
          </>
        )}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            aspectRatio: '1',
            borderRadius: 16,
            border: '4px solid #fff',
            boxShadow: it.shadow,
            overflow: 'hidden',
            background: '#FFE9D2',
          }}
        >
          {it.hasImg ? (
            <div style={{ width: '100%', height: '100%', background: 'center/cover no-repeat', backgroundImage: it.bg, pointerEvents: 'none', transform: it.flipT }} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                textAlign: 'center',
                fontFamily: "'Hanken Grotesk',sans-serif",
                fontWeight: 800,
                fontSize: 12,
                lineHeight: 1.15,
                color: '#1C1520',
                background: 'repeating-linear-gradient(135deg,#FFE3EE 0 8px,#FFD1E3 8px 16px)',
              }}
            >
              {it.label}
            </div>
          )}
        </div>
      </div>
      <div style={{ ...NAME_PILL, background: it.color }}>{it.name}</div>
      {it.tagBelow && <div style={{ ...TAG, marginTop: 4 }}>{it.tag}</div>}
      <div
        style={{
          width: 5,
          height: it.stickPx,
          marginTop: -8,
          borderRadius: 2,
          background: 'linear-gradient(90deg,oklch(0.74 0.06 65),oklch(0.89 0.05 80),oklch(0.72 0.06 65))',
          boxShadow: '1px 0 2px oklch(0.3 0.05 40 / 0.2)',
        }}
      />
    </div>
  );
}

export function Ghost({ g }: { g: GhostVM }) {
  return (
    <div
      data-ghost={g.id}
      style={{
        position: 'absolute',
        left: g.left,
        top: g.top,
        width: g.w,
        transform: `translate(-50%,-100%) rotate(${g.rot}deg)`,
        transformOrigin: '50% 100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: g.z,
        opacity: g.op,
        transition: 'left 700ms cubic-bezier(.3,1.25,.5,1),top 700ms cubic-bezier(.3,1.25,.5,1),opacity 300ms',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 16,
          border: `3px dashed ${g.border}`,
          background: g.fill,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>{g.emoji}</div>
        <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 800, fontSize: 10, color: '#1C1520', textAlign: 'center' }}>{g.status}</div>
      </div>
      <div style={{ ...NAME_PILL, background: g.color }}>{g.name}</div>
      <div style={{ width: 4, height: g.stickPx, marginTop: -8, borderRadius: 2, background: 'repeating-linear-gradient(180deg,oklch(0.74 0.06 65) 0 6px,transparent 6px 10px)' }} />
    </div>
  );
}
