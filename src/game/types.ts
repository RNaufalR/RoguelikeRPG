// ============================================================================
// Core shared types for the roguelike engine.
// Keeping all cross-system contracts in one place guarantees that the engine,
// the data registries, the save system and the UI never drift out of sync.
// ============================================================================

export type Vec2 = { x: number; y: number };

/** High level game state machine. The loop only advances simulation on 'playing'. */
export type Phase =
  | "menu"
  | "playing"
  | "levelup"
  | "paused"
  | "gameover";

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type SkillTag =
  | "damage"
  | "projectile"
  | "dash"
  | "buff"
  | "summon"
  | "cc"
  | "passive"
  | "movement"
  | "defense"
  | "fusion"
  | "elemental";

export type EquipSlot =
  | "weapon"
  | "helm"
  | "armor"
  | "boots"
  | "ring"
  | "amulet";

export type EnemyBehavior =
  | "melee"
  | "ranged"
  | "swarm"
  | "tank"
  | "elite"
  | "boss";

// ----------------------------------------------------------------------------
// Minimal API the engine exposes to skill effects. Keeping it tiny prevents the
// data layer from reaching into engine internals and creating fragile coupling.
// ----------------------------------------------------------------------------
export interface EngineApi {
  addFamiliar(): void;
  spawnText(x: number, y: number, text: string, color: string, size?: number): void;
}

/** Context handed to a skill's apply() so it can mutate the player safely. */
export interface SkillEffectContext {
  player: PlayerRuntime;
  engine: EngineApi;
  /** Resulting stack level of the skill AFTER this pickup (1 = first acquire). */
  level: number;
}

/** A single skill/perk definition. Pure data + an apply function. */
export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  tags: SkillTag[];
  maxLevel: number;
  /** Relative chance to appear in the level-up draft. */
  weight: number;
  /** Human readable, level-aware description. */
  desc: (level: number) => string;
  /** Apply (or upgrade) the effect. Called with the new stack level. */
  apply: (ctx: SkillEffectContext) => void;
  /** Optional gating for upgrade-path skills (e.g. requires an existing skill). */
  requires?: (player: PlayerRuntime) => boolean;
  /** Marks a fusion/evolution capstone for special UI styling. */
  fusion?: boolean;
}

// ----------------------------------------------------------------------------
// ACTIVE SKILLS — periodic special attacks (laser, tornado, blizzard, meteor,
// black hole, chain lightning). They auto-fire on a cooldown and spawn visual
// "effects" that the engine simulates & renders. Mythic actives are bought
// with gold in the shop; regular actives drop from treasure / level-ups.
// ----------------------------------------------------------------------------
export type EffectKind =
  | "blizzard"
  | "laser"
  | "tornado"
  | "lightning"
  | "meteor"
  | "blackhole";

/** Declaration handed to the engine to spawn a transient combat effect. */
export interface EffectSpec {
  kind: EffectKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius: number;
  damage: number;
  life: number;
  tickRate?: number;
  angle?: number;
  spin?: number;
  color: string;
  width?: number;
  count?: number;
  warn?: number;
  followPlayer?: boolean;
}

/** Runtime instance of an active-skill effect (pooled by the engine). */
export interface ActiveEffect {
  active: boolean;
  kind: EffectKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  tick: number;
  tickRate: number;
  angle: number;
  spin: number;
  color: string;
  width: number;
  count: number;
  warn: number;
  followPlayer: boolean;
  struck: boolean;
  points: { x: number; y: number }[];
  hit: Set<number>;
}

/** Minimal read-only API an active skill's fire() may use to place its effect. */
export interface ActiveSkillEngineApi {
  spawnEffect(spec: EffectSpec): void;
  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null;
  getEnemies(): readonly Enemy[];
  playerX(): number;
  playerY(): number;
  facing(): { x: number; y: number };
}

export interface ActiveSkillFireCtx {
  engine: ActiveSkillEngineApi;
  player: PlayerRuntime;
  level: number;
}

/** A periodic active ability. Pure data + a fire() that spawns effects. */
export interface ActiveSkillDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  tags: SkillTag[];
  maxLevel: number;
  weight: number;
  /** Shop-only legendary active (purchased with gold). */
  mythic: boolean;
  /** Gold cost for the FIRST level; later levels cost costBase * 1.5^level. */
  costBase: number;
  cooldown: (level: number) => number;
  desc: (level: number) => string;
  fire: (ctx: ActiveSkillFireCtx) => void;
  /** Optional gating (e.g. a fusion active that needs invested skills). */
  requires?: (player: PlayerRuntime) => boolean;
  /** Marks a fusion/evolution capstone for special UI styling. */
  fusion?: boolean;
}

// ----------------------------------------------------------------------------
// EQUIPMENT — buyable gear. Each piece permanently augments the player's stats
// when acquired (applied exactly once; idempotent & tracked via ownedEquipment).
// Slots are thematic categories. Extend by appending to equipment.ts.
// ----------------------------------------------------------------------------
export interface EquipmentStat {
  /** Key matches a PlayerRuntime field name (validated at apply time). */
  stat: string;
  mode: "add" | "mul";
  value: number;
}

export interface EquipmentDef {
  id: string;
  name: string;
  icon: string;
  slot: EquipSlot;
  rarity: Rarity;
  cost: number;
  stats: EquipmentStat[];
  desc: string;
}

/** Immutable enemy archetype. The engine scales these at spawn time. */
export interface EnemyDef {
  id: string;
  name: string;
  behavior: EnemyBehavior;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  xpReward: number;
  goldReward: number;
  radius: number;
  color: string;
  /** Ranged units stop at this distance; melee use it as contact reach. */
  attackRange: number;
  attackInterval: number;
  isBoss?: boolean;
}

// ----------------------------------------------------------------------------
// Runtime entities (plain objects for cache friendliness & easy pooling).
// ----------------------------------------------------------------------------
export interface Enemy {
  uid: number;
  defId: string;
  behavior: EnemyBehavior;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  xpReward: number;
  goldReward: number;
  attackRange: number;
  attackTimer: number;
  attackInterval: number;
  isBoss: boolean;
  hitFlash: number;
  slowTimer: number;
  slowFactor: number;
  spawnAnim: number;
  contactCd: number;
  elite: boolean;
  /** Bosses occasionally use a special move timer. */
  specialTimer: number;
}

export interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  pierce: number;
  life: number;
  fromPlayer: boolean;
  color: string;
  crit: boolean;
  /** Enemy uids already struck (only allocated when pierce > 0). */
  hit?: Set<number>;
}

export type PickupType = "xp" | "gold" | "heal" | "chest";

export interface Pickup {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: PickupType;
  value: number;
  radius: number;
  magnet: boolean;
  bob: number;
}

export interface Familiar {
  x: number;
  y: number;
  angle: number;
  cooldown: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

// ----------------------------------------------------------------------------
// Player runtime: flat struct of every stat a skill can touch.
// ----------------------------------------------------------------------------
export interface PlayerRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;

  hp: number;
  maxHp: number;
  hpRegen: number;
  armor: number;
  lifesteal: number;
  thorns: number;
  invuln: number;

  level: number;
  xp: number;
  xpToNext: number;

  damage: number;
  attackSpeed: number;
  attackTimer: number;
  projectileSpeed: number;
  projectileCount: number;
  projectilePierce: number;
  projectileRadius: number;
  areaMult: number;
  critChance: number;
  critMult: number;

  moveSpeed: number;
  pickupRadius: number;
  bonusXp: number;
  bonusGold: number;

  hasDash: boolean;
  dashCooldown: number;
  dashTimer: number;
  dashDuration: number;
  dashActive: number;

  familiarCount: number;
  familiarDamage: number;

  frostAuraRadius: number;
  frostAuraSlow: number;

  gold: number;
  kills: number;
  /** Passive skill id -> stack level. */
  skills: Record<string, number>;
  /** Active skill id -> stack level. */
  activeSkills: Record<string, number>;
  /** Equipment ids that have been acquired (each applies its bonus once). */
  ownedEquipment: string[];
  /** Slot -> equipped equipment id (display + loadout tracking). */
  equipped: Partial<Record<EquipSlot, string>>;
}

/** A drafted choice presented on level up. */
export interface SkillOffer {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  tags: SkillTag[];
  desc: string;
  newLevel: number;
  maxLevel: number;
  isNew: boolean;
  /** passive = stat perk; active = periodic special attack. */
  kind: "passive" | "active";
  /** True when this offer is a fusion/evolution capstone. */
  fusion?: boolean;
}

export interface BossHUD {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
}

export interface UISnapshot {
  phase: Phase;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  wave: number;
  threatPct: number;
  timeSec: number;
  gold: number;
  kills: number;
  enemyCount: number;
  hasDash: boolean;
  dashCdPct: number;
  offers: SkillOffer[];
  pendingLevels: number;
  boss: BossHUD | null;
  ownedSkills: { id: string; level: number; icon: string; name: string }[];
  ownedActiveSkills: {
    id: string;
    name: string;
    icon: string;
    level: number;
    mythic: boolean;
    cdPct: number;
  }[];
  ownedEquipment: string[];
  equipped: { slot: EquipSlot; id: string; name: string; icon: string }[];
  zone: string;
  fps: number;
}
