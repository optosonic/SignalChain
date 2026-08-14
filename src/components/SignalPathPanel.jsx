import React, { useCallback, useRef, useState } from 'react';
import {
  DEFAULT_FX_ORDER,
  FX_SLOT_META,
  normalizeFxOrder,
  swapFxOrder,
} from '../fxSlots.js';

function GripDots({ color }) {
  return (
    <div className="grid grid-cols-2 gap-[3px] opacity-70" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-[2px] w-[2px] rounded-full" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function ChainLink() {
  return (
    <div className="flex shrink-0 items-center">
      <div className="h-[2px] w-3 bg-amber-400/55" />
      <div className="h-[5px] w-[5px] rounded-full bg-amber-400/55" />
    </div>
  );
}

function TerminalNode({ label, variant = 'in' }) {
  const isIn = variant === 'in';
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold text-white/90 ${
        isIn
          ? 'border-emerald-500 bg-emerald-500/25 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
          : 'border-rose-400 bg-rose-500/25 shadow-[0_0_12px_rgba(251,113,133,0.25)]'
      }`}
    >
      {label}
    </div>
  );
}

function ChainModule({ slot, compact, isDragging, isPlaceholder, onPointerDown, moduleRef }) {
  const meta = FX_SLOT_META[slot];
  const size = compact ? 'h-7 w-7' : 'h-14 w-14';
  const labelSize = compact ? 'text-[6.5px]' : 'text-[9px]';

  return (
    <button
      type="button"
      ref={moduleRef}
      onPointerDown={onPointerDown}
      className={`relative shrink-0 select-none rounded border font-mono font-semibold ${size} ${labelSize} ${
        isDragging ? 'z-20 cursor-grabbing shadow-[0_8px_24px_rgba(0,0,0,0.55)]' : 'cursor-grab'
      } ${isPlaceholder ? 'border-dashed bg-black/20' : 'bg-gradient-to-b from-black/40 to-[#0a1220]'}`}
      style={{
        borderColor: isPlaceholder ? `${meta.color}88` : meta.color,
        boxShadow: isDragging
          ? `0 0 0 2px ${meta.color}, 0 12px 28px rgba(0,0,0,0.45)`
          : `0 0 0 1px ${meta.color}55, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      aria-label={`${meta.label} module, drag to reorder`}
    >
      {!compact && (
        <span className="absolute left-1.5 top-2">
          <GripDots color={meta.color} />
        </span>
      )}
      <span className="flex h-full w-full items-center justify-center text-white/90">{meta.label}</span>
    </button>
  );
}

/** PHOTONE-style reorderable master FX chain UI. */
export default function SignalPathPanel({
  order = DEFAULT_FX_ORDER,
  onOrderChange,
  compact = false,
  className = '',
}) {
  const moduleRefs = useRef([]);
  const dragRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });

  const displayOrder = normalizeFxOrder(order);
  const previewOrder =
    dragState != null ? swapFxOrder(displayOrder, dragState.from, dragState.over) : displayOrder;

  const indexFromClientX = useCallback((clientX) => {
    let best = 0;
    let bestDist = Infinity;
    moduleRefs.current.forEach((el, i) => {
      if (!el) return;
      const cx = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
      const d = Math.abs(cx - clientX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, []);

  const finishDrag = useCallback(
    (from, over) => {
      if (from == null || over == null || !onOrderChange) return;
      onOrderChange(swapFxOrder(displayOrder, from, over));
    },
    [displayOrder, onOrderChange]
  );

  const handlePointerDown = (index) => (event) => {
    if (!onOrderChange) return;
    event.preventDefault();
    const rect = moduleRefs.current[index]?.getBoundingClientRect();
    dragRef.current = {
      from: index,
      over: index,
      grabX: event.clientX - (rect?.left ?? event.clientX),
      grabY: event.clientY - (rect?.top ?? event.clientY),
      pointerId: event.pointerId,
    };
    setDragState({ from: index, over: index });
    setFloatPos({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.over = indexFromClientX(event.clientX);
    setDragState({ from: drag.from, over: drag.over });
    setFloatPos({ x: event.clientX, y: event.clientY });
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    finishDrag(drag.from, drag.over);
    dragRef.current = null;
    setDragState(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const draggedSlot = dragState != null ? displayOrder[dragState.from] : null;

  return (
    <section
      className={`rounded-xl border border-cyan-500/30 bg-[#060b14]/90 p-3 shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] ${className}`}
    >
      <div className={`mb-2 flex flex-wrap items-center gap-3 ${compact ? 'mb-1' : ''}`}>
        <h3 className={`font-semibold text-white ${compact ? 'text-[10px]' : 'text-sm'}`}>Signal Path</h3>
        {!compact && (
          <p className="font-mono text-[9px] text-white/45">
            Drag the modules to reorder the master chain — audio is rewired live.
          </p>
        )}
      </div>

      <div
        className="relative flex items-center justify-center overflow-x-auto py-2"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-0">
          <TerminalNode label="IN" variant="in" />
          <ChainLink />
          {previewOrder.map((slot, index) => {
            const placeholder = dragState != null && index === dragState.over;
            const hidden = dragState != null && index === dragState.from && !placeholder;
            return (
              <React.Fragment key={`${slot}-${index}`}>
                <div className={hidden ? 'invisible' : ''}>
                  <ChainModule
                    slot={placeholder ? draggedSlot : slot}
                    compact={compact}
                    isDragging={false}
                    isPlaceholder={placeholder}
                    moduleRef={(el) => {
                      moduleRefs.current[index] = el;
                    }}
                    onPointerDown={handlePointerDown(index)}
                  />
                </div>
                {index < previewOrder.length - 1 && <ChainLink />}
              </React.Fragment>
            );
          })}
          <ChainLink />
          <TerminalNode label="OUT" variant="out" />
        </div>

        {dragState != null && draggedSlot && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              left: floatPos.x - (dragRef.current?.grabX ?? 28),
              top: floatPos.y - (dragRef.current?.grabY ?? 28),
            }}
          >
            <ChainModule slot={draggedSlot} compact={compact} isDragging isPlaceholder={false} />
          </div>
        )}
      </div>
    </section>
  );
}
