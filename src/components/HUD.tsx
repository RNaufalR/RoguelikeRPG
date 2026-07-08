// ============================================================================
// HUD (read-only stats, pointer-events-none so it never steals joystick input)
// + DASH & SHOP action buttons (pointer-events-auto). Active-skill icons show a
// bottom-up cooldown overlay. Dynamic fills use inline styles so Tailwind never
// has to scan dynamic class names.
// ============================================================================
import { type PointerEvent as RPE } from "react";
import type { Engine } from "../game/Engine";
import type { UISnapshot } from "../game/types";
import { formatTime, vibrate } from "../game/utils";

export function HUD({
  snap,
  engine,
  onOpenShop,
}: {
  snap: UISnapshot;
  engine: Engine;
  onOpenShop: () => void;
}) {
  const hpPct = snap.maxHp > 0 ? snap.hp / snap.maxHp : 0;
  const xpPct = snap.xpToNext > 0 ? snap.xp / snap.xpToNext : 0;
  const threatColor =
    snap.threatPct > 130 ? "#ef4444" : snap.threatPct > 70 ? "#f59e0b" : "#22d3ee";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {snap.boss && snap.boss.active && (
        <div className="mx-auto mb-1.5 max-w-md">
          <div className="mb-0.5 flex justify-between text-[10px] font-bold uppercase tracking-wider text-rose-300">
            <span className="truncate">⚠ {snap.boss.name}</span>
            <span className="tabular-nums">{Math.ceil(snap.boss.hp)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-rose-500/40">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, (snap.boss.hp / snap.boss.maxHp) * 100))}%`,
                background: "linear-gradient(90deg,#fb7185,#ef4444)",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-rose-200">HP</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, hpPct * 100))}%`,
                  background: "linear-gradient(90deg,#f87171,#dc2626)",
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/80">
              {Math.ceil(snap.hp)}/{Math.round(snap.maxHp)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-cyan-500/20 px-1 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-400/30">
              LV {snap.level}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, xpPct * 100))}%`,
                  background: "linear-gradient(90deg,#22d3ee,#3b82f6)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[10px] font-bold leading-tight text-violet-300">{snap.zone}</div>
          <div className="text-xs font-bold text-amber-300">
            WAVE {snap.wave} · {formatTime(snap.timeSec)}
          </div>
        </div>

        <button
          onPointerDown={(e: RPE<HTMLButtonElement>) => {
            e.preventDefault();
            vibrate(8);
            onOpenShop();
          }}
          className="pointer-events-auto flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-lg bg-black/40 text-base text-amber-300 ring-1 ring-amber-400/30 active:scale-90"
        >
          🛒
        </button>
        <button
          onPointerDown={(e: RPE<HTMLButtonElement>) => {
            e.preventDefault();
            engine.pause();
          }}
          className="pointer-events-auto flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-lg bg-black/40 text-white/80 ring-1 ring-white/15 active:scale-90"
        >
          ⏸
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/70">
        <div className="flex gap-2.5 tabular-nums">
          <span>💰 {snap.gold}</span>
          <span>💀 {snap.kills}</span>
          <span>👾 {snap.enemyCount}</span>
          <span className="text-white/40">{snap.fps}fps</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/40">THREAT</span>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/60">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, snap.threatPct)}%`, background: threatColor }}
            />
          </div>
        </div>
      </div>

      {snap.ownedSkills.length > 0 && (
        <div className="mt-1.5 flex max-w-full flex-wrap gap-1">
          {snap.ownedSkills.map((s) => (
            <span
              key={s.id}
              title={`${s.name} · Lv ${s.level}`}
              className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 py-0.5 text-[11px] ring-1 ring-white/10"
            >
              <span>{s.icon}</span>
              {s.level > 1 && <span className="text-white/50">{s.level}</span>}
            </span>
          ))}
        </div>
      )}

      {snap.ownedActiveSkills.length > 0 && (
        <div className="mt-1 flex gap-1">
          {snap.ownedActiveSkills.map((s) => (
            <div
              key={s.id}
              title={`${s.name} · Lv ${s.level}`}
              className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white/5 text-sm ring-1 ring-white/10"
            >
              <span>{s.icon}</span>
              {s.cdPct > 0.001 && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/60"
                  style={{ height: `${s.cdPct * 100}%` }}
                />
              )}
              {s.level > 1 && (
                <span className="absolute right-0 top-0 rounded-bl bg-black/50 px-0.5 text-[8px] font-bold text-white/70">
                  {s.level}
                </span>
              )}
              {s.mythic && <span className="absolute left-0 top-0 text-[8px] text-amber-300">★</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashButton({ engine, snap }: { engine: Engine; snap: UISnapshot }) {
  const ready = snap.hasDash && snap.dashCdPct <= 0.001;

  if (!snap.hasDash) {
    return (
      <div className="pointer-events-none absolute bottom-7 right-6 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-center text-[9px] font-bold leading-tight text-white/30">
        DASH
        <br />
        LOCKED
      </div>
    );
  }

  return (
    <button
      onPointerDown={(e: RPE<HTMLButtonElement>) => {
        e.preventDefault();
        engine.triggerDash();
        vibrate(8);
      }}
      className={`absolute bottom-7 right-6 z-20 flex h-20 w-20 touch-none items-center justify-center overflow-hidden rounded-full border-2 text-2xl active:scale-95 ${
        ready
          ? "border-cyan-300 bg-cyan-500/30 text-white shadow-[0_0_18px_rgba(34,211,238,0.55)]"
          : "border-white/15 bg-white/5 text-white/40"
      }`}
    >
      <span className="relative z-10">💨</span>
      {!ready && (
        <div
          className="absolute inset-x-0 bottom-0 bg-black/60"
          style={{ height: `${snap.dashCdPct * 100}%` }}
        />
      )}
    </button>
  );
}
