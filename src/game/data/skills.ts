// ============================================================================
// SKILL REGISTRY (the build system).
// Each entry is pure data + a small apply(). To add a skill: append an object.
// Stats are mutated incrementally on pickup, so stacking Just Works. The
// draftOffers() helper centralises the level-up RNG so the engine never needs
// to know skill internals.
// ============================================================================
import type {
  PlayerRuntime,
  SkillDef,
  SkillOffer,
  SkillEffectContext,
} from "../types";
import { RNG } from "../utils";
import { RARITY_WEIGHTS } from "../config";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

// Helper that multiplies a stat and reports the cumulative effect in the desc.
const mul = (base: number, per: number, level: number): number =>
  // applied incrementally each pickup, so the total is base*(per^level)
  base * Math.pow(per, level);

export const SKILLS: SkillDef[] = [
  // ----------------------------- DAMAGE -----------------------------------
  {
    id: "sharp_blades",
    name: "Sharp Blades",
    icon: "⚔️",
    rarity: "common",
    tags: ["damage"],
    maxLevel: 6,
    weight: 1,
    desc: (l) => `+18% Damage  (total +${pct(mul(1, 1.18, l) - 1)})`,
    apply: (c) => {
      c.player.damage *= 1.18;
    },
  },
  {
    id: "heavy_strikes",
    name: "Heavy Strikes",
    icon: "💥",
    rarity: "uncommon",
    tags: ["damage"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+0.35× Critical Damage  (total +${(0.35 * l).toFixed(2)}×)`,
    apply: (c) => {
      c.player.critMult += 0.35;
    },
  },
  {
    id: "deadly_aim",
    name: "Deadly Aim",
    icon: "🎯",
    rarity: "rare",
    tags: ["damage"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+8% Critical Chance  (total +${pct(0.08 * l)})`,
    apply: (c) => {
      c.player.critChance += 0.08;
    },
  },
  {
    id: "berserk",
    name: "Berserk",
    icon: "😡",
    rarity: "epic",
    tags: ["damage", "buff"],
    maxLevel: 3,
    weight: 0.7,
    desc: (l) => `+25% Damage & +6% Move Speed  (×${l})`,
    apply: (c) => {
      c.player.damage *= 1.25;
      c.player.moveSpeed *= 1.06;
    },
  },

  // --------------------------- PROJECTILE ---------------------------------
  {
    id: "multishot",
    name: "Multishot",
    icon: "🔱",
    rarity: "epic",
    tags: ["projectile"],
    maxLevel: 3,
    weight: 0.8,
    desc: (l) => `+1 Projectile  (total ${l + 1})`,
    apply: (c) => {
      c.player.projectileCount += 1;
    },
  },
  {
    id: "piercing",
    name: "Piercing Rounds",
    icon: "➡️",
    rarity: "uncommon",
    tags: ["projectile"],
    maxLevel: 3,
    weight: 1,
    desc: (l) => `+1 Pierce  (total ${l})`,
    apply: (c) => {
      c.player.projectilePierce += 1;
    },
  },
  {
    id: "velocity",
    name: "Velocity",
    icon: "💨",
    rarity: "uncommon",
    tags: ["projectile"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+20% Projectile Speed  (total +${pct(mul(1, 1.2, l) - 1)})`,
    apply: (c) => {
      c.player.projectileSpeed *= 1.2;
    },
  },
  {
    id: "rapid_fire",
    name: "Rapid Fire",
    icon: "🔥",
    rarity: "rare",
    tags: ["projectile", "buff"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+16% Attack Speed  (total +${pct(mul(1, 1.16, l) - 1)})`,
    apply: (c) => {
      c.player.attackSpeed *= 1.16;
    },
  },
  {
    id: "greater_blast",
    name: "Greater Blast",
    icon: "🌟",
    rarity: "rare",
    tags: ["projectile"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+18% Projectile Size & Area  (total +${pct(mul(1, 1.18, l) - 1)})`,
    apply: (c) => {
      c.player.areaMult *= 1.18;
    },
  },

  // ----------------------------- DASH -------------------------------------
  {
    id: "blink_step",
    name: "Blink Step",
    icon: "🌀",
    rarity: "rare",
    tags: ["dash", "movement"],
    maxLevel: 3,
    weight: 0.9,
    desc: (l) =>
      l === 1
        ? "Unlocks Dash — blink through enemies, gaining brief invulnerability."
        : `Dash cooldown −20%  (total ×${Math.pow(0.8, l - 1).toFixed(2)})`,
    apply: (c) => {
      if (c.level === 1) c.player.hasDash = true;
      else c.player.dashCooldown *= 0.8;
    },
  },

  // --------------------------- MOVEMENT -----------------------------------
  {
    id: "swift_feet",
    name: "Swift Feet",
    icon: "👟",
    rarity: "common",
    tags: ["movement"],
    maxLevel: 5,
    weight: 1,
    desc: (l) => `+12% Move Speed  (total +${pct(mul(1, 1.12, l) - 1)})`,
    apply: (c) => {
      c.player.moveSpeed *= 1.12;
    },
  },
  {
    id: "adrenaline",
    name: "Adrenaline",
    icon: "⚡",
    rarity: "rare",
    tags: ["movement", "buff"],
    maxLevel: 3,
    weight: 0.8,
    desc: (l) => `+14% Move Speed & +10% Attack Speed  (×${l})`,
    apply: (c) => {
      c.player.moveSpeed *= 1.14;
      c.player.attackSpeed *= 1.1;
    },
  },

  // ----------------------------- BUFF -------------------------------------
  {
    id: "vampiric",
    name: "Vampiric",
    icon: "🩸",
    rarity: "uncommon",
    tags: ["buff"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+6% Lifesteal  (total +${pct(0.06 * l)})`,
    apply: (c) => {
      c.player.lifesteal += 0.06;
    },
  },
  {
    id: "regeneration",
    name: "Regeneration",
    icon: "♻️",
    rarity: "common",
    tags: ["buff"],
    maxLevel: 5,
    weight: 1,
    desc: (l) => `+1.6 HP/sec  (total +${(1.6 * l).toFixed(1)}/s)`,
    apply: (c) => {
      c.player.hpRegen += 1.6;
      // Small instant gratification on pickup.
      c.player.hp = Math.min(c.player.maxHp, c.player.hp + 8);
    },
  },

  // --------------------------- DEFENSE ------------------------------------
  {
    id: "thick_skin",
    name: "Thick Skin",
    icon: "🛡️",
    rarity: "common",
    tags: ["defense", "passive"],
    maxLevel: 6,
    weight: 1,
    desc: (l) => `+26 Max HP  (total +${26 * l})`,
    apply: (c) => {
      c.player.maxHp += 26;
      c.player.hp += 26;
    },
  },
  {
    id: "iron_will",
    name: "Iron Will",
    icon: "🏰",
    rarity: "uncommon",
    tags: ["defense"],
    maxLevel: 5,
    weight: 1,
    desc: (l) => `+3 Armor  (total +${3 * l})`,
    apply: (c) => {
      c.player.armor += 3;
    },
  },
  {
    id: "thorns",
    name: "Thorns",
    icon: "🌵",
    rarity: "uncommon",
    tags: ["defense", "cc"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `Reflect +9 damage to attackers  (total +${9 * l})`,
    apply: (c) => {
      c.player.thorns += 9;
    },
  },

  // ---------------------------- SUMMON ------------------------------------
  {
    id: "spirit_familiar",
    name: "Spirit Familiar",
    icon: "👻",
    rarity: "epic",
    tags: ["summon"],
    maxLevel: 4,
    weight: 0.8,
    desc: (l) =>
      l === 1
        ? "Summon a familiar that orbits you and auto-attacks."
        : `+1 Familiar, +4 Familiar Damage  (total ${l})`,
    apply: (c) => {
      c.player.familiarCount += 1;
      if (c.level > 1) c.player.familiarDamage += 4;
      c.engine.addFamiliar();
    },
  },
  {
    id: "empower_familiar",
    name: "Empower Familiar",
    icon: "✨",
    rarity: "rare",
    tags: ["summon"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+35% Familiar Damage  (total ×${Math.pow(1.35, l).toFixed(2)})`,
    requires: (p) => p.familiarCount > 0,
    apply: (c) => {
      c.player.familiarDamage *= 1.35;
    },
  },

  // ------------------------------ CC --------------------------------------
  {
    id: "frost_aura",
    name: "Frost Aura",
    icon: "❄️",
    rarity: "rare",
    tags: ["cc"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) =>
      `Chills nearby enemies: +70 radius, +12% slow  (radius ${70 * l}, slow ${pct(
        Math.min(0.7, 0.12 * l)
      )})`,
    apply: (c) => {
      c.player.frostAuraRadius += 70;
      c.player.frostAuraSlow = Math.min(0.7, c.player.frostAuraSlow + 0.12);
    },
  },

  // --------------------------- PASSIVE / UTILITY -------------------------
  {
    id: "magnetism",
    name: "Magnetism",
    icon: "🧲",
    rarity: "common",
    tags: ["passive"],
    maxLevel: 3,
    weight: 1,
    desc: (l) => `+45 Pickup Range  (total +${45 * l})`,
    apply: (c) => {
      c.player.pickupRadius += 45;
    },
  },
  {
    id: "scholar",
    name: "Scholar",
    icon: "📖",
    rarity: "uncommon",
    tags: ["passive"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+15% XP Gain  (total +${pct(0.15 * l)})`,
    apply: (c) => {
      c.player.bonusXp += 0.15;
    },
  },
  {
    id: "greed",
    name: "Greed",
    icon: "💰",
    rarity: "uncommon",
    tags: ["passive"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+25% Gold Gain  (total +${pct(0.25 * l)})`,
    apply: (c) => {
      c.player.bonusGold += 0.25;
    },
  },

  // ===================== EXPANDED PASSIVE POOL =============================
  {
    id: "executioner",
    name: "Executioner",
    icon: "💀",
    rarity: "epic",
    tags: ["damage", "buff"],
    maxLevel: 4,
    weight: 0.8,
    desc: (l) => `+5% Crit & +0.4× Crit Dmg  (×${l})`,
    apply: (c) => {
      c.player.critChance += 0.05;
      c.player.critMult += 0.4;
    },
  },
  {
    id: "bloodlust",
    name: "Bloodlust",
    icon: "🩸",
    rarity: "rare",
    tags: ["buff", "defense"],
    maxLevel: 4,
    weight: 0.85,
    desc: (l) => `+4% Lifesteal & +6% Damage  (×${l})`,
    apply: (c) => {
      c.player.lifesteal += 0.04;
      c.player.damage *= 1.06;
    },
  },
  {
    id: "swift_strike",
    name: "Swift Strike",
    icon: "🥷",
    rarity: "uncommon",
    tags: ["buff"],
    maxLevel: 5,
    weight: 1,
    desc: (l) => `+10% Attack Speed  (total +${pct(mul(1, 1.1, l) - 1)})`,
    apply: (c) => {
      c.player.attackSpeed *= 1.1;
    },
  },
  {
    id: "giant_growth",
    name: "Giant Growth",
    icon: "🟢",
    rarity: "rare",
    tags: ["defense", "buff"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+40 Max HP & +8% Area  (×${l})`,
    apply: (c) => {
      c.player.maxHp += 40;
      c.player.hp += 40;
      c.player.areaMult *= 1.08;
    },
  },
  {
    id: "arcane_focus",
    name: "Arcane Focus",
    icon: "💠",
    rarity: "rare",
    tags: ["projectile", "buff"],
    maxLevel: 4,
    weight: 0.9,
    desc: (l) => `+12% Proj Speed & +10% Area  (×${l})`,
    apply: (c) => {
      c.player.projectileSpeed *= 1.12;
      c.player.areaMult *= 1.1;
    },
  },
  {
    id: "gem_hunter",
    name: "Gem Hunter",
    icon: "💠",
    rarity: "common",
    tags: ["passive"],
    maxLevel: 4,
    weight: 1,
    desc: (l) => `+35 Pickup Range & +8% XP  (×${l})`,
    apply: (c) => {
      c.player.pickupRadius += 35;
      c.player.bonusXp += 0.08;
    },
  },
  {
    id: "iron_body",
    name: "Iron Body",
    icon: "⛓️",
    rarity: "rare",
    tags: ["defense"],
    maxLevel: 5,
    weight: 0.9,
    desc: (l) => `+5 Armor & +1 HP/s  (×${l})`,
    apply: (c) => {
      c.player.armor += 5;
      c.player.hpRegen += 1;
    },
  },
  {
    id: "master_assassin",
    name: "Master Assassin",
    icon: "🎯",
    rarity: "epic",
    tags: ["damage"],
    maxLevel: 3,
    weight: 0.75,
    desc: (l) => `+7% Crit & +0.5× Crit Dmg  (×${l})`,
    apply: (c) => {
      c.player.critChance += 0.07;
      c.player.critMult += 0.5;
    },
  },
  {
    id: "fury",
    name: "Fury",
    icon: "🔥",
    rarity: "rare",
    tags: ["damage", "buff"],
    maxLevel: 4,
    weight: 0.85,
    desc: (l) => `+12% Damage & +6% Attack Speed  (×${l})`,
    apply: (c) => {
      c.player.damage *= 1.12;
      c.player.attackSpeed *= 1.06;
    },
  },
  {
    id: "frost_mastery",
    name: "Frost Mastery",
    icon: "🧊",
    rarity: "epic",
    tags: ["cc", "elemental"],
    maxLevel: 4,
    weight: 0.8,
    desc: (l) => `+50 Frost Radius & +8% Slow  (×${l})`,
    apply: (c) => {
      c.player.frostAuraRadius += 50;
      c.player.frostAuraSlow = Math.min(0.75, c.player.frostAuraSlow + 0.08);
    },
  },
  {
    id: "titan",
    name: "Titan",
    icon: "🗿",
    rarity: "epic",
    tags: ["defense", "movement"],
    maxLevel: 3,
    weight: 0.8,
    desc: (l) => `+70 Max HP & +6% Move Speed  (×${l})`,
    apply: (c) => {
      c.player.maxHp += 70;
      c.player.hp += 70;
      c.player.moveSpeed *= 1.06;
    },
  },
  {
    id: "soul_link",
    name: "Soul Link",
    icon: "🔗",
    rarity: "rare",
    tags: ["summon", "buff"],
    maxLevel: 4,
    weight: 0.85,
    desc: (l) => `+30% Familiar Damage & +5% Damage  (×${l})`,
    requires: (p) => p.familiarCount > 0,
    apply: (c) => {
      c.player.familiarDamage *= 1.3;
      c.player.damage *= 1.05;
    },
  },
  {
    id: "battle_hunger",
    name: "Battle Hunger",
    icon: "🍖",
    rarity: "uncommon",
    tags: ["buff", "defense"],
    maxLevel: 5,
    weight: 0.95,
    desc: (l) => `+3% Lifesteal & +1.2 HP/s  (×${l})`,
    apply: (c) => {
      c.player.lifesteal += 0.03;
      c.player.hpRegen += 1.2;
    },
  },

  // ==================== FUSION / EVOLUTION CAPSTONES =======================
  // These only appear once you've invested in their component skills, creating
  // a natural skill-tree of powerful evolved abilities at raised rarity.
  {
    id: "fus_overload",
    name: "OVERLOAD",
    icon: "☄️",
    rarity: "mythic",
    tags: ["projectile", "damage", "fusion"],
    maxLevel: 3,
    weight: 2,
    fusion: true,
    requires: (p) =>
      (p.skills["multishot"] ?? 0) >= 1 &&
      (p.skills["rapid_fire"] ?? 0) >= 1 &&
      (p.skills["greater_blast"] ?? 0) >= 1,
    desc: (l) =>
      `Evolution: +1 Projectile, +20% Damage, +12% Area & Atk Speed  (Lv ${l})`,
    apply: (c) => {
      c.player.projectileCount += 1;
      c.player.damage *= 1.2;
      c.player.areaMult *= 1.12;
      c.player.attackSpeed *= 1.12;
    },
  },
  {
    id: "fus_blood_lord",
    name: "BLOOD LORD",
    icon: "🦇",
    rarity: "mythic",
    tags: ["buff", "defense", "fusion"],
    maxLevel: 3,
    weight: 2,
    fusion: true,
    requires: (p) =>
      (p.skills["vampiric"] ?? 0) >= 2 && (p.skills["berserk"] ?? 0) >= 1,
    desc: (l) =>
      `Evolution: +12% Lifesteal, +25% Damage, +30 Max HP  (Lv ${l})`,
    apply: (c) => {
      c.player.lifesteal += 0.12;
      c.player.damage *= 1.25;
      c.player.maxHp += 30;
      c.player.hp += 30;
    },
  },
  {
    id: "fus_cryo_genesis",
    name: "CRYO GENESIS",
    icon: "🏔️",
    rarity: "mythic",
    tags: ["cc", "elemental", "fusion"],
    maxLevel: 3,
    weight: 2,
    fusion: true,
    requires: (p) => (p.skills["frost_aura"] ?? 0) >= 2,
    desc: (l) =>
      `Evolution: +90 Frost Radius, +15% Slow, +12% Damage  (Lv ${l})`,
    apply: (c) => {
      c.player.frostAuraRadius += 90;
      c.player.frostAuraSlow = Math.min(0.8, c.player.frostAuraSlow + 0.15);
      c.player.damage *= 1.12;
    },
  },
  {
    id: "fus_undying",
    name: "UNDYING",
    icon: "♾️",
    rarity: "mythic",
    tags: ["defense", "fusion"],
    maxLevel: 3,
    weight: 2,
    fusion: true,
    requires: (p) =>
      (p.skills["thick_skin"] ?? 0) >= 3 &&
      (p.skills["iron_will"] ?? 0) >= 2 &&
      (p.skills["regeneration"] ?? 0) >= 2,
    desc: (l) =>
      `Evolution: +120 Max HP, +10 Armor, +6 HP/s, +20 Thorns  (Lv ${l})`,
    apply: (c) => {
      c.player.maxHp += 120;
      c.player.hp += 120;
      c.player.armor += 10;
      c.player.hpRegen += 6;
      c.player.thorns += 20;
    },
  },
  {
    id: "fus_warlord",
    name: "WARLORD",
    icon: "⚔️",
    rarity: "legendary",
    tags: ["damage", "defense", "fusion"],
    maxLevel: 3,
    weight: 2.2,
    fusion: true,
    requires: (p) =>
      (p.skills["sharp_blades"] ?? 0) >= 3 && (p.skills["thorns"] ?? 0) >= 1,
    desc: (l) =>
      `Evolution: +22% Damage, +12 Thorns, +0.3× Crit Dmg  (Lv ${l})`,
    apply: (c) => {
      c.player.damage *= 1.22;
      c.player.thorns += 12;
      c.player.critMult += 0.3;
    },
  },
  {
    id: "fus_swift_god",
    name: "WIND GOD",
    icon: "🌪️",
    rarity: "legendary",
    tags: ["movement", "buff", "fusion"],
    maxLevel: 3,
    weight: 2.2,
    fusion: true,
    requires: (p) =>
      (p.skills["swift_feet"] ?? 0) >= 2 && (p.skills["adrenaline"] ?? 0) >= 1,
    desc: (l) =>
      `Evolution: +16% Move Speed, +10% Atk Speed, +30 Pickup  (Lv ${l})`,
    apply: (c) => {
      c.player.moveSpeed *= 1.16;
      c.player.attackSpeed *= 1.1;
      c.player.pickupRadius += 30;
    },
  },
  {
    id: "fus_eternal_hunter",
    name: "ETERNAL HUNTER",
    icon: "🦅",
    rarity: "legendary",
    tags: ["passive", "fusion"],
    maxLevel: 3,
    weight: 2.2,
    fusion: true,
    requires: (p) =>
      (p.skills["scholar"] ?? 0) >= 2 &&
      (p.skills["magnetism"] ?? 0) >= 1 &&
      (p.skills["greed"] ?? 0) >= 1,
    desc: (l) =>
      `Evolution: +30% XP, +30% Gold, +50 Pickup Range  (Lv ${l})`,
    apply: (c) => {
      c.player.bonusXp += 0.3;
      c.player.bonusGold += 0.3;
      c.player.pickupRadius += 50;
    },
  },
];

export const SKILL_MAP: Record<string, SkillDef> = SKILLS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, SkillDef>
);

export const getSkill = (id: string): SkillDef | undefined => SKILL_MAP[id];

/** Build a fair, distinct, rarity-weighted set of level-up choices. */
export function draftOffers(
  player: PlayerRuntime,
  rng: RNG,
  count: number
): SkillOffer[] {
  const pool = SKILLS.filter((s) => {
    const cur = player.skills[s.id] ?? 0;
    if (cur >= s.maxLevel) return false;
    if (s.requires && !s.requires(player)) return false;
    return true;
  });
  if (pool.length === 0) return [];

  const offers: SkillOffer[] = [];
  const used = new Set<string>();
  let safety = count * 10;

  while (offers.length < count && safety-- > 0) {
    const avail = pool.filter((s) => !used.has(s.id));
    if (avail.length === 0) break;
    const picked = rng.weighted(
      avail.map((s) => ({
        item: s,
        weight: s.weight * (RARITY_WEIGHTS[s.rarity] ?? 1),
      }))
    );
    if (!picked || used.has(picked.id)) continue;
    used.add(picked.id);
    const cur = player.skills[picked.id] ?? 0;
    offers.push({
      id: picked.id,
      name: picked.name,
      icon: picked.icon,
      rarity: picked.rarity,
      tags: picked.tags,
      desc: picked.desc(cur + 1),
      newLevel: cur + 1,
      maxLevel: picked.maxLevel,
      isNew: cur === 0,
      kind: "passive",
    });
  }
  return offers;
}

// Re-exported so skills.ts is the single import site for effect contexts.
export type { SkillEffectContext };
