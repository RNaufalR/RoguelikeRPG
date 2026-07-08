// ============================================================================
// VIRTUAL JOYSTICK
// Floating analog stick: appears wherever the thumb first touches inside its
// zone. All visuals are driven via refs/transforms — NO React state on move —
// so dragging is perfectly smooth and never triggers a re-render. The engine
// receives a normalised, analog (magnitude-aware) vector directly.
// ============================================================================
import { useRef, type PointerEvent as RPE } from "react";
import type { Engine } from "../game/Engine";

const MAX_RADIUS = 54;

export function VirtualJoystick({ engine }: { engine: Engine }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const st = useRef({ active: false, id: -1, ox: 0, oy: 0 });

  const place = (x: number, y: number) => {
    const tf = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    if (baseRef.current) {
      baseRef.current.style.transform = tf;
      baseRef.current.style.opacity = "1";
    }
    if (knobRef.current) {
      knobRef.current.style.transform = tf;
      knobRef.current.style.opacity = "1";
    }
  };

  const hide = () => {
    if (baseRef.current) baseRef.current.style.opacity = "0";
    if (knobRef.current) knobRef.current.style.opacity = "0";
  };

  const update = (cx: number, cy: number) => {
    const s = st.current;
    const dx = cx - s.ox;
    const dy = cy - s.oy;
    const d = Math.hypot(dx, dy);
    const clamped = Math.min(d, MAX_RADIUS);
    const nx = d > 0 ? dx / d : 0;
    const ny = d > 0 ? dy / d : 0;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${s.ox + nx * clamped}px, ${
        s.oy + ny * clamped
      }px) translate(-50%, -50%)`;
    }
    const mag = Math.min(1, d / MAX_RADIUS);
    engine.setMove(nx * mag, ny * mag, true);
  };

  const onDown = (e: RPE<HTMLDivElement>) => {
    const z = zoneRef.current;
    if (!z) return;
    const r = z.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const s = st.current;
    s.active = true;
    s.id = e.pointerId;
    s.ox = cx;
    s.oy = cy;
    place(cx, cy);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture optional */
    }
    update(cx, cy);
  };

  const onMove = (e: RPE<HTMLDivElement>) => {
    const s = st.current;
    if (!s.active || e.pointerId !== s.id) return;
    const z = zoneRef.current;
    if (!z) return;
    const r = z.getBoundingClientRect();
    update(e.clientX - r.left, e.clientY - r.top);
  };

  const onUp = () => {
    const s = st.current;
    if (!s.active) return;
    s.active = false;
    engine.setMove(0, 0, false);
    hide();
  };

  return (
    <div
      ref={zoneRef}
      className="absolute inset-y-0 left-0 z-10 w-[58%] touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        ref={baseRef}
        className="pointer-events-none absolute left-0 top-0 h-28 w-28 rounded-full border-2 border-cyan-400/40 bg-cyan-400/5 opacity-0"
      />
      <div
        ref={knobRef}
        className="pointer-events-none absolute left-0 top-0 h-12 w-12 rounded-full bg-cyan-400/70 opacity-0 shadow-[0_0_14px_rgba(34,211,238,0.7)]"
      />
    </div>
  );
}
