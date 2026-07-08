// ============================================================================
// ENEMY REGISTRY. Archetypes are plain data; the engine scales HP/damage/speed
// AND rewards at spawn time using the difficulty curve. Add an enemy by
// appending here and (optionally) wiring it into the spawn weights below.
//
// NOTE on xpReward:
//   XP is delivered exclusively through pickups (gems). Base values below are
//   already tuned so that a wave-1 kill grants the SAME total XP as the old
//   (buggy) double-XP behaviour; once waves/threat ramp up, rewards scale up
//   with enemy toughness so level-ups keep pace with difficulty.
// ============================================================================
import type { EnemyDef } from "../types";
import { RNG } from "../utils";

export const ENEMIES: EnemyDef[] = [
  {
    id: "slime",
    name: "Slime",
    behavior: "melee",
    baseHp: 22,
    baseSpeed: 58,
    baseDamage: 8,
    xpReward: 6,
    goldReward: 2,
    radius: 14,
    color: "#84cc16",
    attackRange: 0,
    attackInterval: 0,
  },
  {
    id: "bat",
    name: "Bat",
    behavior: "swarm",
    baseHp: 10,
    baseSpeed: 112,
    baseDamage: 6,
    xpReward: 4,
    goldReward: 2,
    radius: 9,
    color: "#a78bfa",
    attackRange: 0,
    attackInterval: 0,
  },
  {
    id: "zombie",
    name: "Zombie",
    behavior: "melee",
    baseHp: 64,
    baseSpeed: 42,
    baseDamage: 12,
    xpReward: 12,
    goldReward: 4,
    radius: 16,
    color: "#65a30d",
    attackRange: 0,
    attackInterval: 0,
  },
  {
    id: "skeleton",
    name: "Skeleton Archer",
    behavior: "ranged",
    baseHp: 26,
    baseSpeed: 56,
    baseDamage: 7,
    xpReward: 10,
    goldReward: 4,
    radius: 12,
    color: "#e2e8f0",
    attackRange: 270,
    attackInterval: 1.9,
  },
  {
    id: "imp",
    name: "Imp",
    behavior: "ranged",
    baseHp: 16,
    baseSpeed: 98,
    baseDamage: 6,
    xpReward: 10,
    goldReward: 4,
    radius: 10,
    color: "#fb7185",
    attackRange: 210,
    attackInterval: 1.5,
  },
  {
    id: "wraith",
    name: "Wraith",
    behavior: "ranged",
    baseHp: 32,
    baseSpeed: 82,
    baseDamage: 9,
    xpReward: 14,
    goldReward: 6,
    radius: 13,
    color: "#38bdf8",
    attackRange: 250,
    attackInterval: 1.4,
  },
  {
    id: "brute",
    name: "Brute",
    behavior: "tank",
    baseHp: 175,
    baseSpeed: 34,
    baseDamage: 22,
    xpReward: 30,
    goldReward: 10,
    radius: 22,
    color: "#b45309",
    attackRange: 0,
    attackInterval: 0,
  },

  // ------------------------------- BOSSES ---------------------------------
  {
    id: "boss_sentinel",
    name: "The Sentinel",
    behavior: "boss",
    baseHp: 2400,
    baseSpeed: 48,
    baseDamage: 24,
    xpReward: 320,
    goldReward: 100,
    radius: 40,
    color: "#f43f5e",
    attackRange: 320,
    attackInterval: 1.2,
    isBoss: true,
  },
  {
    id: "boss_lich",
    name: "The Lich King",
    behavior: "boss",
    baseHp: 3600,
    baseSpeed: 40,
    baseDamage: 20,
    xpReward: 460,
    goldReward: 160,
    radius: 46,
    color: "#a855f7",
    attackRange: 390,
    attackInterval: 0.95,
    isBoss: true,
  },
  {
    id: "boss_behemoth",
    name: "The Behemoth",
    behavior: "boss",
    baseHp: 6000,
    baseSpeed: 32,
    baseDamage: 34,
    xpReward: 700,
    goldReward: 240,
    radius: 56,
    color: "#f59e0b",
    attackRange: 0,
    attackInterval: 0,
    isBoss: true,
  },
];

export const ENEMY_MAP: Record<string, EnemyDef> = ENEMIES.reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EnemyDef>
);

export const getEnemy = (id: string): EnemyDef | undefined => ENEMY_MAP[id];

/** Spawn weights shift with the wave, introducing tougher units over time. */
export function enemyWeights(wave: number): { defId: string; weight: number }[] {
  const w: { defId: string; weight: number }[] = [
    { defId: "slime", weight: 6 },
    { defId: "bat", weight: 5 },
  ];
  if (wave >= 2) w.push({ defId: "zombie", weight: 3 });
  if (wave >= 3) w.push({ defId: "skeleton", weight: 3 });
  if (wave >= 4) w.push({ defId: "imp", weight: 3 });
  if (wave >= 5) w.push({ defId: "wraith", weight: 2.5 });
  if (wave >= 7) w.push({ defId: "brute", weight: 2 });
  return w.filter((o) => o.weight > 0);
}

export function pickEnemyDefId(wave: number, rng: RNG): string {
  const ws = enemyWeights(wave);
  if (ws.length === 0) return "slime";
  return rng.weighted(
    ws.map((o) => ({ item: o.defId, weight: o.weight }))
  );
}

export function pickBossDefId(wave: number, rng: RNG): string {
  if (wave >= 15) return rng.bool(0.5) ? "boss_behemoth" : "boss_lich";
  if (wave >= 10) return "boss_lich";
  return "boss_sentinel";
}
