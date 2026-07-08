// ============================================================================
// Central tuning. Every magic number lives here so balance changes are safe
// and reviewable. Nothing in the engine hardcodes gameplay values.
// ============================================================================

export const CONFIG = {
  // --- World ---
  arenaW: 2200,
  arenaH: 2200,
  /** Hard caps keep mid/low-end phones from choking on entity counts. */
  maxEnemies: 130,
  maxProjectiles: 260,
  maxPickups: 220,
  maxTexts: 48,
  maxEffects: 48,
  /** Cap canvas pixel ratio. 2 is sharp enough; lower saves fill-rate on weak GPUs. */
  maxDpr: 2,

  // --- Timing / loop safety ---
  maxDt: 0.05, // clamp frame delta to avoid simulation explosion on stalls
  waveDuration: 28, // seconds per wave
  uiUpdateInterval: 0.08, // throttle React HUD updates (~12.5 fps)

  // --- Player base stats (before any skill) ---
  player: {
    maxHp: 110,
    damage: 11,
    attackSpeed: 1.7,
    projectileSpeed: 430,
    projectileCount: 1,
    projectilePierce: 0,
    projectileRadius: 7,
    moveSpeed: 198,
    pickupRadius: 78,
    critChance: 0.05,
    critMult: 1.6,
    hpRegen: 0,
    armor: 0,
    lifesteal: 0,
    thorns: 0,
    areaMult: 1,
    bonusXp: 0,
    bonusGold: 0,
    hasDash: false,
    dashCooldown: 3.2,
    dashDuration: 0.18,
    dashSpeedMult: 3.3,
    familiarCount: 0,
    familiarDamage: 6,
    familiarCooldown: 0.85,
    invulnTime: 0.6,
  },

  // --- Levelling curve ---
  xpBase: 6,
  xpGrowth: 1.32,

  // --- Difficulty scaling ---
  difficulty: {
    threatPerSec: 0.011, // passive threat ramp (time pressure)
    threatPerWave: 0.12,
    hpPerWave: 0.2,
    hpPerThreat: 0.55,
    dmgPerWave: 0.09,
    dmgPerThreat: 0.32,
    speedPerWave: 0.015,
    bossEveryWave: 5, // a boss spawns at this wave cadence
    eliteChanceBase: 0.04,
    eliteChancePerWave: 0.012,
  },

  // --- Spawning ---
  spawn: {
    baseInterval: 1.15,
    intervalPerWave: 0.06, // subtracted each wave (faster spawns)
    minInterval: 0.22,
    baseCount: 4,
    countPerWave: 0.9, // added each wave
    spawnMargin: 90, // px outside the view edge
  },

  // --- Pickups ---
  pickup: {
    /** Xp from a single gem on a normal enemy is computed from the enemy's
     *  scaled xpReward; this constant is unused in drop generation but kept
     *  for UI/sanity. */
    gemXp: 6,
    healChance: 0.030,
    healAmount: 18,
    /** Chests give a free skill draft — tuned so they feel exciting but not
     *  spammed. Scales with wave. */
    chestChance: 0.028,
    chestChancePerWave: 0.0025,
    magnetSpeed: 520,
  },

  // --- Endless zones (cycle forever as waves climb) ---
  zones: [
    "Ember Glade",
    "Frostbound Caverns",
    "Ashen Wastes",
    "Sunken Crypts",
    "Storm Peaks",
    "Void Rift",
  ],
  zoneDepthEvery: 5, // waves per zone step

  // --- Minimap ---
  minimap: {
    size: 104,              // px on screen
    margin: 12,
    // positioned from top-right, below the top HUD bar
    topOffset: 70,
  },

  // --- Visual ---
  colors: {
    player: "#7dd3fc",
    playerCore: "#e0f2fe",
    projectile: "#fde68a",
    enemyProj: "#fca5a5",
    xpGem: "#34d399",
    gold: "#fbbf24",
    heal: "#f472b6",
    chest: "#c4b5fd",
    danger: "#f87171",
  },
} as const;

export const RARITY_COLORS: Record<string, string> = {
  common: "#cbd5e1",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#fbbf24",
  mythic: "#f472b6",
};

export const RARITY_WEIGHTS: Record<string, number> = {
  common: 100,
  uncommon: 60,
  rare: 32,
  epic: 14,
  legendary: 5,
  mythic: 2,
};

export const RARITY_GLOW: Record<string, string> = {
  common: "rgba(203,213,225,0.25)",
  uncommon: "rgba(74,222,128,0.30)",
  rare: "rgba(96,165,250,0.35)",
  epic: "rgba(192,132,252,0.40)",
  legendary: "rgba(251,191,36,0.50)",
  mythic: "rgba(244,114,182,0.60)",
};
