// ============================================================================
// ACTIVE SKILL REGISTRY — periodic special attacks.
// Each active ability auto-fires on a cooldown and spawns a transient combat
// "effect" (declared via EffectSpec) that the Engine simulates & renders.
//
// Regular actives (mythic=false) drop from treasure chests and appear in the
// level-up draft. Mythic actives (mythic=true) are LEGENDARY and can only be
// purchased with gold in the shop.
//
// To add an active skill: append an object. To add a new EFFECT VISUAL, add a
// kind to EffectKind + handle it in Engine.updateActiveEffects/drawActiveEffect.
// ============================================================================
import type {
  ActiveSkillDef,
  ActiveSkillFireCtx,
  EffectSpec,
  Enemy,
  PlayerRuntime,
  Rarity,
  SkillTag,
} from "../types";
import { CONFIG } from "../config";

const dmg = (p: PlayerRuntime, mult: number): number => p.damage * mult;

/** Drop a meteor-sized burst onto a target near the player. */
function meteorAt(ctx: ActiveSkillFireCtx, x: number, y: number): void {
  const spec: EffectSpec = {
    kind: "meteor",
    x,
    y,
    radius: 64 + ctx.level * 10,
    damage: dmg(ctx.player, 3 + ctx.level * 0.8),
    life: 1.1,
    warn: 0.7,
    color: "#fb923c",
  };
  ctx.engine.spawnEffect(spec);
}

export const ACTIVE_SKILLS: ActiveSkillDef[] = [
  // ----------------------- REGULAR (treasure / level-up) --------------------
  {
    id: "ice_nova",
    name: "Frost Nova",
    icon: "❄️",
    rarity: "rare",
    tags: ["cc", "damage"],
    maxLevel: 5,
    weight: 1,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(4, 6.5 - l * 0.35),
    desc: (l) => `Blizzard around you: ${(90 + l * 14)}px, ${(2 + l * 0.6).toFixed(1)}× dmg, slows.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 90 + c.level * 14,
        damage: dmg(c.player, 2 + c.level * 0.6),
        life: 3,
        tickRate: 0.3,
        color: "#38bdf8",
        angle: 0,
        spin: 2,
      });
    },
  },
  {
    id: "whirlwind",
    name: "Whirlwind",
    icon: "🌀",
    rarity: "rare",
    tags: ["cc", "damage"],
    maxLevel: 5,
    weight: 1,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(4.5, 7 - l * 0.4),
    desc: (l) => `A moving tornado that pulls & shreds: ${(70 + l * 10)}px.`,
    fire: (c) => {
      const f = c.engine.facing();
      c.engine.spawnEffect({
        kind: "tornado",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        vx: (f.x || 1) * 150,
        vy: f.y * 150,
        radius: 70 + c.level * 10,
        damage: dmg(c.player, 1.4 + c.level * 0.4),
        life: 4,
        tickRate: 0.22,
        color: "#e2e8f0",
        spin: 6,
      });
    },
  },
  {
    id: "chain_bolt",
    name: "Chain Lightning",
    icon: "⚡",
    rarity: "epic",
    tags: ["damage"],
    maxLevel: 5,
    weight: 0.9,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(3.5, 5.5 - l * 0.4),
    desc: (l) => `Lightning arcs to ${3 + l} enemies for ${(2 + l * 0.5).toFixed(1)}× dmg.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "lightning",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 240,
        damage: dmg(c.player, 2 + c.level * 0.5),
        life: 0.35,
        color: "#a78bfa",
        count: 3 + c.level,
      });
    },
  },
  {
    id: "arcane_laser",
    name: "Arcane Laser",
    icon: "🔆",
    rarity: "epic",
    tags: ["damage"],
    maxLevel: 5,
    weight: 0.9,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(5, 8 - l * 0.5),
    desc: (l) => `A sweeping laser beam: ${(20 + l * 4)}px wide.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "laser",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 520,
        width: 20 + c.level * 4,
        damage: dmg(c.player, 1.2 + c.level * 0.3),
        life: 2,
        tickRate: 0.1,
        color: "#c084fc",
        angle: 0,
        spin: 2.6,
      });
    },
  },

  // ----------------------------- MYTHIC (gold shop) -------------------------
  {
    id: "mythic_meteor",
    name: "Meteor Storm",
    icon: "☄️",
    rarity: "legendary",
    tags: ["damage", "cc"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 140,
    cooldown: (l) => Math.max(7, 12 - l * 0.6),
    desc: (l) => `Calls ${3 + l} meteors, each ${(64 + l * 10)}px for ${(3 + l * 0.8).toFixed(1)}× dmg.`,
    fire: (c) => {
      const n = 3 + c.level;
      for (let i = 0; i < n; i++) {
        const tgt: Enemy | null = c.engine.nearestEnemy(c.engine.playerX(), c.engine.playerY(), 700);
        const x = tgt ? tgt.x : c.engine.playerX() + (Math.random() - 0.5) * 400;
        const y = tgt ? tgt.y : c.engine.playerY() + (Math.random() - 0.5) * 400;
        meteorAt(c, x, y);
      }
    },
  },
  {
    id: "mythic_singularity",
    name: "Singularity",
    icon: "🕳️",
    rarity: "legendary",
    tags: ["cc", "damage"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 160,
    cooldown: (l) => Math.max(8, 13 - l * 0.6),
    desc: (l) => `A black hole that devours everything in ${(200 + l * 18)}px.`,
    fire: (c) => {
      const tgt = c.engine.nearestEnemy(c.engine.playerX(), c.engine.playerY(), 600);
      c.engine.spawnEffect({
        kind: "blackhole",
        x: tgt ? tgt.x : c.engine.playerX(),
        y: tgt ? tgt.y : c.engine.playerY(),
        radius: 200 + c.level * 18,
        damage: dmg(c.player, 2 + c.level * 0.6),
        life: 3.5,
        tickRate: 0.2,
        color: "#818cf8",
        spin: 3,
      });
    },
  },
  {
    id: "mythic_deathray",
    name: "Death Ray",
    icon: "🔫",
    rarity: "legendary",
    tags: ["damage"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 180,
    cooldown: (l) => Math.max(7, 11 - l * 0.5),
    desc: (l) => `A colossal rotating beam, ${(38 + l * 6)}px wide, melting all it touches.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "laser",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 740,
        width: 38 + c.level * 6,
        damage: dmg(c.player, 1.6 + c.level * 0.4),
        life: 2.6,
        tickRate: 0.08,
        color: "#f87171",
        angle: 0,
        spin: 1.7,
      });
    },
  },
  {
    id: "mythic_blizzard",
    name: "Absolute Zero",
    icon: "🌨️",
    rarity: "legendary",
    tags: ["cc", "damage"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 150,
    cooldown: (l) => Math.max(7, 11 - l * 0.5),
    desc: (l) => `An enormous blizzard: ${(150 + l * 18)}px, ${(3 + l * 0.8).toFixed(1)}× dmg, deep freeze.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 150 + c.level * 18,
        damage: dmg(c.player, 3 + c.level * 0.8),
        life: 4,
        tickRate: 0.25,
        color: "#60a5fa",
        angle: 0,
        spin: 1.5,
      });
    },
  },

  // ===================== MORE REGULAR ACTIVES ==============================
  {
    id: "solar_flare",
    name: "Solar Flare",
    icon: "🌟",
    rarity: "rare",
    tags: ["damage", "elemental"],
    maxLevel: 5,
    weight: 1,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(4, 7 - l * 0.4),
    desc: (l) => `A fiery nova around you: ${(80 + l * 12)}px, ${(2.5 + l * 0.6).toFixed(1)}× dmg.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "meteor",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 80 + c.level * 12,
        damage: dmg(c.player, 2.5 + c.level * 0.6),
        life: 0.9,
        warn: 0.35,
        color: "#f59e0b",
      });
    },
  },
  {
    id: "poison_cloud",
    name: "Venom Cloud",
    icon: "☠️",
    rarity: "rare",
    tags: ["damage", "cc", "elemental"],
    maxLevel: 5,
    weight: 1,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(5, 8 - l * 0.4),
    desc: (l) => `A lingering poison cloud: ${(95 + l * 12)}px, fast ticks.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 95 + c.level * 12,
        damage: dmg(c.player, 1.3 + c.level * 0.3),
        life: 3.5,
        tickRate: 0.18,
        color: "#22c55e",
        angle: 0,
        spin: 1.2,
      });
    },
  },
  {
    id: "soul_nova",
    name: "Soul Nova",
    icon: "💫",
    rarity: "epic",
    tags: ["damage", "buff"],
    maxLevel: 5,
    weight: 0.9,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(5, 8 - l * 0.4),
    desc: (l) => `Damaging nova that fuels lifesteal: ${(110 + l * 14)}px.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 110 + c.level * 14,
        damage: dmg(c.player, 1.8 + c.level * 0.4),
        life: 0.6,
        tickRate: 0.2,
        color: "#f0abfc",
        angle: 0,
        spin: 4,
      });
    },
  },
  {
    id: "earth_shatter",
    name: "Earth Shatter",
    icon: "🌋",
    rarity: "epic",
    tags: ["damage", "cc"],
    maxLevel: 5,
    weight: 0.9,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(6, 9 - l * 0.4),
    desc: (l) => `Erupts ${2 + Math.floor(l / 2)} meteors ahead, each for ${(3 + l * 0.6).toFixed(1)}× dmg.`,
    fire: (c) => {
      const f = c.engine.facing();
      const n = 2 + Math.floor(c.level / 2);
      for (let i = 0; i < n; i++) {
        const ox = (f.x || 1) * (120 + i * 90);
        const oy = f.y * (120 + i * 90);
        meteorAt(c, c.engine.playerX() + ox, c.engine.playerY() + oy);
      }
    },
  },
  {
    id: "time_warp",
    name: "Time Warp",
    icon: "⏳",
    rarity: "epic",
    tags: ["cc", "elemental"],
    maxLevel: 4,
    weight: 0.85,
    mythic: false,
    costBase: 0,
    cooldown: (l) => Math.max(8, 12 - l * 0.6),
    desc: (l) => `Slows ALL nearby foes drastically for a moment (radius ${400 + l * 60}).`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 400 + c.level * 60,
        damage: dmg(c.player, 0.4 + c.level * 0.1),
        life: 2.4,
        tickRate: 0.4,
        color: "#67e8f9",
        angle: 0,
        spin: 0.8,
      });
    },
  },

  // ===================== MORE MYTHIC ACTIVES (shop) ========================
  {
    id: "mythic_apocalypse",
    name: "Apocalypse",
    icon: "🌋",
    rarity: "mythic",
    tags: ["damage", "elemental"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 200,
    cooldown: (l) => Math.max(9, 15 - l * 0.7),
    desc: (l) => `Rains ${5 + l} meteors across the battlefield.`,
    fire: (c) => {
      const n = 5 + c.level;
      const ens = c.engine.getEnemies();
      for (let i = 0; i < n; i++) {
        let x: number;
        let y: number;
        if (ens.length > 0) {
          const pick = ens[Math.floor(Math.random() * ens.length)];
          x = pick.x + (Math.random() - 0.5) * 160;
          y = pick.y + (Math.random() - 0.5) * 160;
        } else {
          x = c.engine.playerX() + (Math.random() - 0.5) * 500;
          y = c.engine.playerY() + (Math.random() - 0.5) * 500;
        }
        meteorAt(c, x, y);
      }
    },
  },
  {
    id: "mythic_judgement",
    name: "Celestial Judgement",
    icon: "✝️",
    rarity: "mythic",
    tags: ["damage", "elemental"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 210,
    cooldown: (l) => Math.max(9, 14 - l * 0.6),
    desc: (l) => `Unleashes 4 sweeping divine beams, ${(30 + l * 5)}px wide.`,
    fire: (c) => {
      for (let i = 0; i < 4; i++) {
        c.engine.spawnEffect({
          kind: "laser",
          x: c.engine.playerX(),
          y: c.engine.playerY(),
          followPlayer: true,
          radius: 600,
          width: 30 + c.level * 5,
          damage: dmg(c.player, 1.4 + c.level * 0.3),
          life: 2,
          tickRate: 0.1,
          color: "#fde68a",
          angle: (i * Math.PI) / 2,
          spin: 1.4,
        });
      }
    },
  },
  {
    id: "mythic_ragnarok",
    name: "Ragnarök",
    icon: "🌩️",
    rarity: "mythic",
    tags: ["damage", "cc", "elemental"],
    maxLevel: 5,
    weight: 0,
    mythic: true,
    costBase: 260,
    cooldown: (l) => Math.max(12, 18 - l * 0.7),
    desc: (l) => `The end times: blizzard + chain lightning + ${3 + l} meteors.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 130 + c.level * 16,
        damage: dmg(c.player, 2 + c.level * 0.5),
        life: 3,
        tickRate: 0.25,
        color: "#818cf8",
        angle: 0,
        spin: 1.4,
      });
      c.engine.spawnEffect({
        kind: "lightning",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 260,
        damage: dmg(c.player, 2.5 + c.level * 0.5),
        life: 0.35,
        color: "#c084fc",
        count: 6 + c.level,
      });
      const n = 3 + c.level;
      const ens = c.engine.getEnemies();
      for (let i = 0; i < n; i++) {
        const pick = ens.length > 0 ? ens[Math.floor(Math.random() * ens.length)] : null;
        const x = pick ? pick.x : c.engine.playerX() + (Math.random() - 0.5) * 400;
        const y = pick ? pick.y : c.engine.playerY() + (Math.random() - 0.5) * 400;
        meteorAt(c, x, y);
      }
    },
  },

  // ================ FUSION ACTIVES (evolution via investment) ===============
  {
    id: "fus_thunderstorm",
    name: "THUNDERSTORM",
    icon: "⛈️",
    rarity: "mythic",
    tags: ["damage", "elemental", "fusion"],
    maxLevel: 3,
    weight: 2,
    mythic: false,
    costBase: 0,
    fusion: true,
    requires: (p) => (p.activeSkills["chain_bolt"] ?? 0) >= 2,
    cooldown: (l) => Math.max(3, 5 - l * 0.3),
    desc: (l) => `Evolution: lightning arcs to ${8 + l * 2} foes for ${(2.5 + l * 0.5).toFixed(1)}× dmg.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "lightning",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        radius: 300,
        damage: dmg(c.player, 2.5 + c.level * 0.5),
        life: 0.4,
        color: "#a78bfa",
        count: 8 + c.level * 2,
      });
    },
  },
  {
    id: "fus_maelstrom",
    name: "MAELSTROM",
    icon: "🌪️",
    rarity: "mythic",
    tags: ["cc", "damage", "fusion"],
    maxLevel: 3,
    weight: 2,
    mythic: false,
    costBase: 0,
    fusion: true,
    requires: (p) => (p.activeSkills["whirlwind"] ?? 0) >= 2,
    cooldown: (l) => Math.max(4, 6.5 - l * 0.4),
    desc: (l) => `Evolution: a colossal tornado, ${(110 + l * 16)}px.`,
    fire: (c) => {
      const f = c.engine.facing();
      c.engine.spawnEffect({
        kind: "tornado",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        vx: (f.x || 1) * 120,
        vy: f.y * 120,
        radius: 110 + c.level * 16,
        damage: dmg(c.player, 1.6 + c.level * 0.4),
        life: 5,
        tickRate: 0.2,
        color: "#bae6fd",
        spin: 7,
      });
    },
  },
  {
    id: "fus_permafrost",
    name: "PERMAFROST",
    icon: "🧊",
    rarity: "mythic",
    tags: ["cc", "elemental", "fusion"],
    maxLevel: 3,
    weight: 2,
    mythic: false,
    costBase: 0,
    fusion: true,
    requires: (p) => (p.activeSkills["ice_nova"] ?? 0) >= 2,
    cooldown: (l) => Math.max(4, 6 - l * 0.3),
    desc: (l) => `Evolution: a deep-freeze blizzard, ${(140 + l * 16)}px, ${(3.5 + l * 0.8).toFixed(1)}× dmg.`,
    fire: (c) => {
      c.engine.spawnEffect({
        kind: "blizzard",
        x: c.engine.playerX(),
        y: c.engine.playerY(),
        followPlayer: true,
        radius: 140 + c.level * 16,
        damage: dmg(c.player, 3.5 + c.level * 0.8),
        life: 3.5,
        tickRate: 0.22,
        color: "#38bdf8",
        angle: 0,
        spin: 2.2,
      });
    },
  },
  {
    id: "fus_void_lance",
    name: "VOID LANCE",
    icon: "🟣",
    rarity: "mythic",
    tags: ["damage", "fusion"],
    maxLevel: 3,
    weight: 2,
    mythic: false,
    costBase: 0,
    fusion: true,
    requires: (p) => (p.activeSkills["arcane_laser"] ?? 0) >= 2,
    cooldown: (l) => Math.max(5, 7.5 - l * 0.4),
    desc: (l) => `Evolution: twin sweeping void beams, ${(44 + l * 6)}px wide.`,
    fire: (c) => {
      for (let i = 0; i < 2; i++) {
        c.engine.spawnEffect({
          kind: "laser",
          x: c.engine.playerX(),
          y: c.engine.playerY(),
          followPlayer: true,
          radius: 680,
          width: 44 + c.level * 6,
          damage: dmg(c.player, 1.8 + c.level * 0.4),
          life: 2.2,
          tickRate: 0.08,
          color: "#c084fc",
          angle: i * Math.PI,
          spin: 2.2,
        });
      }
    },
  },
];

export const ACTIVE_SKILL_MAP: Record<string, ActiveSkillDef> = ACTIVE_SKILLS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, ActiveSkillDef>
);

export const getActiveSkill = (id: string): ActiveSkillDef | undefined =>
  ACTIVE_SKILL_MAP[id];

/** Mythic actives available in the gold shop. */
export const MYTHIC_ACTIVE: ActiveSkillDef[] = ACTIVE_SKILLS.filter((s) => s.mythic);

/** Gold cost to BUY/upgrade an active skill given its current level. */
export function activeCost(def: ActiveSkillDef, currentLevel: number): number {
  return Math.round(def.costBase * Math.pow(1.5, currentLevel));
}

// Keep imports referenced for type-only tree-shaking safety.
export type { Rarity, SkillTag };
void CONFIG;
