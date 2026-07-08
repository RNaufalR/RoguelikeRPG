// ============================================================================
// EQUIPMENT REGISTRY — buyable gear that permanently augments player stats.
// Acquired exactly once (tracked by Engine via ownedEquipment), so application
// is idempotent and can never double-apply. Slots are thematic categories.
//
// To add gear: append an EquipmentDef. stats[] entries map a PlayerRuntime field
// to an add/mul delta. The apply is validated, so unknown fields are ignored
// safely rather than crashing.
// ============================================================================
import type { EquipmentDef, PlayerRuntime } from "../types";

export const EQUIPMENT: EquipmentDef[] = [
  // ----------------------------- WEAPONS -----------------------------------
  {
    id: "rusted_blade",
    name: "Rusted Blade",
    icon: "🗡️",
    slot: "weapon",
    rarity: "common",
    cost: 40,
    stats: [{ stat: "damage", mode: "mul", value: 1.12 }],
    desc: "+12% Damage",
  },
  {
    id: "sharpened_saber",
    name: "Sharpened Saber",
    icon: "⚔️",
    slot: "weapon",
    rarity: "uncommon",
    cost: 95,
    stats: [
      { stat: "damage", mode: "mul", value: 1.2 },
      { stat: "attackSpeed", mode: "mul", value: 1.08 },
    ],
    desc: "+20% Damage, +8% Attack Speed",
  },
  {
    id: "stormcaller",
    name: "Stormcaller",
    icon: "⚡",
    slot: "weapon",
    rarity: "rare",
    cost: 190,
    stats: [
      { stat: "damage", mode: "mul", value: 1.18 },
      { stat: "critChance", mode: "add", value: 0.12 },
      { stat: "projectileSpeed", mode: "mul", value: 1.1 },
    ],
    desc: "+18% Damage, +12% Crit, faster shots",
  },
  {
    id: "blade_of_eons",
    name: "Blade of Eons",
    icon: "🔆",
    slot: "weapon",
    rarity: "legendary",
    cost: 460,
    stats: [
      { stat: "damage", mode: "mul", value: 1.35 },
      { stat: "critMult", mode: "add", value: 0.6 },
      { stat: "areaMult", mode: "mul", value: 1.15 },
    ],
    desc: "+35% Damage, +0.6× Crit Dmg, +15% Area",
  },

  // ------------------------------- HELMS -----------------------------------
  {
    id: "leather_cap",
    name: "Leather Cap",
    icon: "🪖",
    slot: "helm",
    rarity: "common",
    cost: 40,
    stats: [{ stat: "maxHp", mode: "add", value: 30 }],
    desc: "+30 Max HP",
  },
  {
    id: "scholars_circlet",
    name: "Scholar's Circlet",
    icon: "🎓",
    slot: "helm",
    rarity: "uncommon",
    cost: 110,
    stats: [
      { stat: "bonusXp", mode: "add", value: 0.25 },
      { stat: "pickupRadius", mode: "add", value: 30 },
    ],
    desc: "+25% XP, +30 Pickup Range",
  },
  {
    id: "crown_of_insight",
    name: "Crown of Insight",
    icon: "👑",
    slot: "helm",
    rarity: "legendary",
    cost: 420,
    stats: [
      { stat: "bonusXp", mode: "add", value: 0.4 },
      { stat: "critChance", mode: "add", value: 0.15 },
      { stat: "maxHp", mode: "add", value: 40 },
    ],
    desc: "+40% XP, +15% Crit, +40 HP",
  },

  // ------------------------------ ARMOR ------------------------------------
  {
    id: "padded_vest",
    name: "Padded Vest",
    icon: "🦺",
    slot: "armor",
    rarity: "common",
    cost: 45,
    stats: [{ stat: "armor", mode: "add", value: 4 }],
    desc: "+4 Armor",
  },
  {
    id: "iron_plate",
    name: "Iron Plate",
    icon: "🛡️",
    slot: "armor",
    rarity: "uncommon",
    cost: 120,
    stats: [
      { stat: "maxHp", mode: "add", value: 60 },
      { stat: "armor", mode: "add", value: 5 },
    ],
    desc: "+60 Max HP, +5 Armor",
  },
  {
    id: "aegis_mantle",
    name: "Aegis Mantle",
    icon: "🏰",
    slot: "armor",
    rarity: "epic",
    cost: 240,
    stats: [
      { stat: "maxHp", mode: "add", value: 110 },
      { stat: "armor", mode: "add", value: 8 },
      { stat: "hpRegen", mode: "add", value: 3 },
    ],
    desc: "+110 HP, +8 Armor, +3 HP/s",
  },
  {
    id: "bulwark_of_gods",
    name: "Bulwark of the Gods",
    icon: "⛓️",
    slot: "armor",
    rarity: "mythic",
    cost: 520,
    stats: [
      { stat: "maxHp", mode: "add", value: 180 },
      { stat: "armor", mode: "add", value: 14 },
      { stat: "thorns", mode: "add", value: 25 },
      { stat: "hpRegen", mode: "add", value: 5 },
    ],
    desc: "+180 HP, +14 Armor, +25 Thorns, +5 HP/s",
  },

  // ------------------------------- BOOTS -----------------------------------
  {
    id: "worn_boots",
    name: "Worn Boots",
    icon: "👟",
    slot: "boots",
    rarity: "common",
    cost: 40,
    stats: [{ stat: "moveSpeed", mode: "mul", value: 1.1 }],
    desc: "+10% Move Speed",
  },
  {
    id: "windwalkers",
    name: "Windwalkers",
    icon: "🥾",
    slot: "boots",
    rarity: "rare",
    cost: 160,
    stats: [
      { stat: "moveSpeed", mode: "mul", value: 1.18 },
      { stat: "pickupRadius", mode: "add", value: 40 },
    ],
    desc: "+18% Move Speed, +40 Pickup",
  },
  {
    id: "boots_of_hermes",
    name: "Boots of Hermes",
    icon: "🌬️",
    slot: "boots",
    rarity: "legendary",
    cost: 380,
    stats: [
      { stat: "moveSpeed", mode: "mul", value: 1.25 },
      { stat: "attackSpeed", mode: "mul", value: 1.12 },
      { stat: "bonusGold", mode: "add", value: 0.2 },
    ],
    desc: "+25% Move, +12% Atk Speed, +20% Gold",
  },

  // ------------------------------- RINGS -----------------------------------
  {
    id: "copper_ring",
    name: "Copper Ring",
    icon: "💍",
    slot: "ring",
    rarity: "common",
    cost: 35,
    stats: [{ stat: "bonusGold", mode: "add", value: 0.2 }],
    desc: "+20% Gold",
  },
  {
    id: "vampiric_signet",
    name: "Vampiric Signet",
    icon: "🩸",
    slot: "ring",
    rarity: "rare",
    cost: 180,
    stats: [
      { stat: "lifesteal", mode: "add", value: 0.1 },
      { stat: "damage", mode: "mul", value: 1.1 },
    ],
    desc: "+10% Lifesteal, +10% Damage",
  },
  {
    id: "ring_of_fortune",
    name: "Ring of Fortune",
    icon: "🍀",
    slot: "ring",
    rarity: "epic",
    cost: 260,
    stats: [
      { stat: "bonusGold", mode: "add", value: 0.5 },
      { stat: "bonusXp", mode: "add", value: 0.2 },
      { stat: "critChance", mode: "add", value: 0.08 },
    ],
    desc: "+50% Gold, +20% XP, +8% Crit",
  },

  // ------------------------------ AMULETS ----------------------------------
  {
    id: "lucky_charm",
    name: "Lucky Charm",
    icon: "🔮",
    slot: "amulet",
    rarity: "uncommon",
    cost: 90,
    stats: [{ stat: "critChance", mode: "add", value: 0.1 }],
    desc: "+10% Crit Chance",
  },
  {
    id: "phoenix_talisman",
    name: "Phoenix Talisman",
    icon: "🔥",
    slot: "amulet",
    rarity: "epic",
    cost: 280,
    stats: [
      { stat: "damage", mode: "mul", value: 1.15 },
      { stat: "hpRegen", mode: "add", value: 4 },
      { stat: "lifesteal", mode: "add", value: 0.05 },
    ],
    desc: "+15% Damage, +4 HP/s, +5% Lifesteal",
  },
  {
    id: "amulet_of_eternity",
    name: "Amulet of Eternity",
    icon: "♾️",
    slot: "amulet",
    rarity: "mythic",
    cost: 540,
    stats: [
      { stat: "damage", mode: "mul", value: 1.22 },
      { stat: "maxHp", mode: "add", value: 120 },
      { stat: "attackSpeed", mode: "mul", value: 1.12 },
      { stat: "critMult", mode: "add", value: 0.5 },
      { stat: "hpRegen", mode: "add", value: 6 },
    ],
    desc: "+22% Dmg, +120 HP, +12% Atk Speed, +0.5× Crit Dmg, +6 HP/s",
  },
];

export const EQUIPMENT_MAP: Record<string, EquipmentDef> = EQUIPMENT.reduce(
  (acc, e) => {
    acc[e.id] = e;
    return acc;
  },
  {} as Record<string, EquipmentDef>
);

export const getEquipment = (id: string): EquipmentDef | undefined => EQUIPMENT_MAP[id];

/** Stat fields that equipment is allowed to touch (validated whitelist). */
const VALID_EQUIP_STATS = new Set<string>([
  "damage",
  "maxHp",
  "armor",
  "lifesteal",
  "moveSpeed",
  "attackSpeed",
  "critChance",
  "critMult",
  "projectileSpeed",
  "pickupRadius",
  "hpRegen",
  "bonusXp",
  "bonusGold",
  "areaMult",
  "thorns",
  "familiarDamage",
  "frostAuraRadius",
]);

/** Apply an equipment's stat bonuses to the player. Safe: unknown/invalid
 *  fields are skipped. maxHp deltas also heal the player by the same amount. */
export function applyEquipment(player: PlayerRuntime, def: EquipmentDef): void {
  for (const s of def.stats) {
    if (!VALID_EQUIP_STATS.has(s.stat)) continue;
    const key = s.stat as keyof PlayerRuntime;
    if (s.mode === "add") {
      if (s.stat === "maxHp") {
        player.maxHp += s.value;
        player.hp += s.value;
      } else {
        (player[key] as number) += s.value;
      }
    } else {
      const before = player[key] as number;
      const after = before * s.value;
      (player[key] as number) = after;
      if (s.stat === "maxHp") player.hp += after - before;
    }
  }
}
