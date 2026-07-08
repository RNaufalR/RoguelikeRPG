// ============================================================================
// SHOP — two tabs: Mythic Skills (legendary actives) and Equipment (stat gear).
// Reachable only while paused (safe state). The live snapshot drives gold,
// ownership (so items can't be double-bought) and equipped loadout display.
// ============================================================================
import { useState } from "react";
import { MYTHIC_ACTIVE, activeCost } from "../game/data/activeSkills";
import { EQUIPMENT } from "../game/data/equipment";
import { RARITY_COLORS, RARITY_GLOW } from "../game/config";
import type { Engine } from "../game/Engine";
import type { EquipSlot, UISnapshot } from "../game/types";
import { vibrate } from "../game/utils";

type Tab = "skills" | "gear";

const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: "Weapon",
  helm: "Helm",
  armor: "Armor",
  boots: "Boots",
  ring: "Ring",
  amulet: "Amulet",
};

export function ShopModal({
  snap,
  engine,
  onClose,
}: {
  snap: UISnapshot;
  engine: Engine;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("skills");

  const buySkill = (id: string) => {
    vibrate(14);
    engine.buyActiveSkill(id);
  };
  const buyGear = (id: string) => {
    vibrate(14);
    engine.buyEquipment(id);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <div className="text-lg font-black text-amber-300">🛒 Vault</div>
          <div className="rounded-lg bg-amber-500/15 px-2 py-1 text-sm font-bold tabular-nums text-amber-200 ring-1 ring-amber-400/30">
            💰 {snap.gold}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2">
          <TabBtn active={tab === "skills"} onClick={() => setTab("skills")}>
            ⚡ Mythic Skills
          </TabBtn>
          <TabBtn active={tab === "gear"} onClick={() => setTab("gear")}>
            🛡️ Equipment
          </TabBtn>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {tab === "skills" ? (
            <div className="flex flex-col gap-2">
              {MYTHIC_ACTIVE.map((def) => {
                const owned = snap.ownedActiveSkills.find((s) => s.id === def.id);
                const level = owned?.level ?? 0;
                const maxed = level >= def.maxLevel;
                const cost = activeCost(def, level);
                const afford = snap.gold >= cost;
                return (
                  <ShopItem
                    key={def.id}
                    icon={def.icon}
                    name={def.name}
                    rarity={def.rarity}
                    badges={["Mythic"]}
                    desc={def.desc(Math.max(1, level))}
                    sub={`Lv ${level}/${def.maxLevel}`}
                    cost={cost}
                    maxed={maxed}
                    afford={afford}
                    onBuy={() => buySkill(def.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {EQUIPMENT.map((def) => {
                const owned = snap.ownedEquipment.includes(def.id);
                const afford = snap.gold >= def.cost;
                return (
                  <ShopItem
                    key={def.id}
                    icon={def.icon}
                    name={def.name}
                    rarity={def.rarity}
                    badges={[SLOT_LABEL[def.slot]]}
                    desc={def.desc}
                    sub={owned ? "✓ Equipped" : SLOT_LABEL[def.slot]}
                    cost={def.cost}
                    maxed={owned}
                    afford={afford}
                    onBuy={() => buyGear(def.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Loadout summary */}
        {snap.equipped.length > 0 && (
          <div className="border-t border-white/10 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
              Loadout
            </div>
            <div className="flex flex-wrap gap-1.5">
              {snap.equipped.map((e) => (
                <span
                  key={e.slot}
                  title={`${e.name} (${e.slot})`}
                  className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-xs ring-1 ring-white/10"
                >
                  <span>{e.icon}</span>
                  <span className="text-white/60">{e.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/10 p-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-white/5 py-3 text-sm font-bold text-white/80 ring-1 ring-white/10 active:scale-95"
          >
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
        active ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40" : "bg-white/5 text-white/50"
      }`}
    >
      {children}
    </button>
  );
}

function ShopItem({
  icon,
  name,
  rarity,
  badges,
  desc,
  sub,
  cost,
  maxed,
  afford,
  onBuy,
}: {
  icon: string;
  name: string;
  rarity: string;
  badges: string[];
  desc: string;
  sub: string;
  cost: number;
  maxed: boolean;
  afford: boolean;
  onBuy: () => void;
}) {
  const color = RARITY_COLORS[rarity] ?? "#cbd5e1";
  const glow = RARITY_GLOW[rarity] ?? "rgba(203,213,225,0.2)";
  return (
    <div className="rounded-xl border bg-white/[0.06] p-3" style={{ borderColor: color }}>
      <div className="flex items-center gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl"
          style={{ background: glow }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold text-white">{name}</span>
            {badges.map((b) => (
              <span
                key={b}
                className="rounded px-1 text-[9px] font-bold uppercase tracking-wide"
                style={{ color, background: "rgba(255,255,255,0.07)" }}
              >
                {b}
              </span>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-white/60">{desc}</p>
          <div className="mt-0.5 text-[10px] text-white/40">{sub}</div>
        </div>
      </div>
      <button
        disabled={maxed || !afford}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!maxed && afford) onBuy();
        }}
        className={`mt-2 w-full rounded-lg py-2 text-xs font-bold transition-transform active:scale-95 ${
          maxed
            ? "bg-white/5 text-white/40"
            : afford
            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-900/30"
            : "bg-white/5 text-white/30"
        }`}
      >
        {maxed ? "✓ Acquired" : afford ? `Acquire · 💰 ${cost}` : `Need 💰 ${cost}`}
      </button>
    </div>
  );
}
