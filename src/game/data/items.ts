// ============================================================================
// LOOT TABLES. Centralised drop logic so the engine just calls roll*() and
// spawns the returned pickups. Extend the item economy by adding drop types
// here (e.g. future potions, relics) without touching engine code.
//
// Key balance rule: total XP/gold for a kill is handed ENTIRELY through pickups,
// so pickup radius, magnetism, and the Scholar/Greed passives all matter. The
// engine's caller must pass in the already-difficulty-scaled reward values.
// ============================================================================
import type { PickupType } from "../types";
import { RNG } from "../utils";
import { CONFIG } from "../config";

export interface LootSpec {
  type: PickupType;
  value: number;
}

/** Drops when a normal enemy dies. */
export function rollEnemyLoot(
  rng: RNG,
  wave: number,
  xpReward: number,
  goldReward: number
): LootSpec[] {
  const out: LootSpec[] = [];

  // Big enemies / elites feel meatier by dropping 2 gems. Every kill drops at
  // least one XP gem — XP is the #1 progression resource, so never zero.
  const gemCount = xpReward >= 18 ? 2 : 1;
  const perGem = Math.max(1, Math.round(xpReward / gemCount));
  for (let i = 0; i < gemCount; i++) {
    out.push({ type: "xp", value: perGem });
  }

  if (goldReward > 0) {
    const goldChance = 0.55 + Math.min(0.25, wave * 0.01);
    if (rng.bool(goldChance)) {
      out.push({ type: "gold", value: Math.max(1, Math.round(goldReward)) });
    }
  }

  if (rng.bool(CONFIG.pickup.healChance)) {
    out.push({ type: "heal", value: CONFIG.pickup.healAmount });
  }

  // Chests give a free skill draft — they should feel rare but attainable.
  const chestP =
    CONFIG.pickup.chestChance + wave * CONFIG.pickup.chestChancePerWave;
  if (rng.bool(chestP)) {
    out.push({ type: "chest", value: 1 });
  }
  return out;
}

/** Drops when a boss dies. Guaranteed heal + chest + a shower of gems/gold
 *  that sums to the scaled reward values. */
export function rollBossLoot(
  rng: RNG,
  wave: number,
  xpReward: number,
  goldReward: number
): LootSpec[] {
  void rng; // reserved for future variability
  const out: LootSpec[] = [];
  const gems = 10 + Math.floor(wave / 2);
  const perGem = Math.max(4, Math.round(xpReward / gems));
  for (let i = 0; i < gems; i++) {
    out.push({ type: "xp", value: perGem });
  }
  const goldCount = 5;
  const perGold = Math.max(3, Math.round(goldReward / goldCount));
  for (let i = 0; i < goldCount; i++) {
    out.push({ type: "gold", value: perGold });
  }
  out.push({ type: "heal", value: 80 });
  out.push({ type: "chest", value: 1 });
  return out;
}
