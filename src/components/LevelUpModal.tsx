// ============================================================================
// LEVEL UP MODAL — the core build moment. Shows the drafted skill offers with
// rarity styling; picking one calls engine.chooseSkill which applies it and
// either drafts the next pending level or resumes play.
// ============================================================================
import type { UISnapshot, SkillOffer } from "../game/types";
import type { Engine } from "../game/Engine";
import { RARITY_COLORS, RARITY_GLOW } from "../game/config";
import { vibrate } from "../game/utils";

export function LevelUpModal({ engine, snap }: { engine: Engine; snap: UISnapshot }) {
  const choose = (id: string) => {
    vibrate(12);
    engine.chooseSkill(id);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <div className="mb-3 text-center">
          <div className="text-2xl font-black tracking-wide text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
            LEVEL UP!
          </div>
          <div className="text-xs text-white/60">
            Choose your power
            {snap.pendingLevels > 1 ? ` · ${snap.pendingLevels} pending` : ""}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {snap.offers.map((o) => (
            <SkillCard key={o.id} offer={o} onPick={() => choose(o.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillCard({ offer, onPick }: { offer: SkillOffer; onPick: () => void }) {
  const color = RARITY_COLORS[offer.rarity] ?? "#cbd5e1";
  const glow = RARITY_GLOW[offer.rarity] ?? "rgba(203,213,225,0.2)";
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-white/[0.06] p-3 text-left transition-transform active:scale-[0.98]"
      style={{ borderColor: color, boxShadow: `0 0 16px ${glow}` }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl"
        style={{ background: glow }}
      >
        {offer.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold text-white">{offer.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            {offer.kind === "active" && (
              <span className="rounded bg-fuchsia-500/25 px-1 text-[9px] font-bold uppercase tracking-wide text-fuchsia-200">
                Active
              </span>
            )}
            {offer.fusion && (
              <span className="rounded bg-pink-500/30 px-1 text-[9px] font-bold uppercase tracking-wide text-pink-200">
                ⚡ Fusion
              </span>
            )}
            <span
              className="rounded px-1 text-[9px] font-bold uppercase tracking-wide"
              style={{ color, background: "rgba(255,255,255,0.07)" }}
            >
              {offer.rarity}
            </span>
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-white/70">{offer.desc}</p>
        <div className="mt-1">
          {offer.isNew ? (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
              ✦ New Ability
            </span>
          ) : (
            <span className="text-[10px] text-white/50">
              Upgrade → Lv {offer.newLevel} / {offer.maxLevel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
