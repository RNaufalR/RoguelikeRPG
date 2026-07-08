// ============================================================================
// COMBINED LEVEL-UP DRAFT. Pulls from BOTH the passive skill pool and the
// non-mythic active skill pool, so treasure chests & level-ups can grant a rich
// mix of stat perks AND special attacks. Mythic actives are intentionally
// excluded here — they are shop-only. (This is a separate module to avoid an
// import cycle between skills.ts and activeSkills.ts.)
// ============================================================================
import type { PlayerRuntime, SkillOffer } from "../types";
import { RNG } from "../utils";
import { RARITY_WEIGHTS } from "../config";
import { SKILLS, getSkill } from "./skills";
import { ACTIVE_SKILLS, getActiveSkill } from "./activeSkills";

interface PoolEntry {
  kind: "passive" | "active";
  id: string;
  weight: number;
}

/** Build a fair, distinct, rarity-weighted set of level-up choices. */
export function draftOffers(
  player: PlayerRuntime,
  rng: RNG,
  count: number
): SkillOffer[] {
  const pool: PoolEntry[] = [];

  for (const s of SKILLS) {
    const cur = player.skills[s.id] ?? 0;
    if (cur >= s.maxLevel) continue;
    if (s.requires && !s.requires(player)) continue;
    pool.push({
      kind: "passive",
      id: s.id,
      weight: s.weight * (RARITY_WEIGHTS[s.rarity] ?? 1),
    });
  }

  for (const s of ACTIVE_SKILLS) {
    if (s.mythic) continue; // shop-only
    const cur = player.activeSkills[s.id] ?? 0;
    if (cur >= s.maxLevel) continue;
    if (s.requires && !s.requires(player)) continue; // fusion gating
    pool.push({
      kind: "active",
      id: s.id,
      weight: s.weight * (RARITY_WEIGHTS[s.rarity] ?? 1) * 0.85,
    });
  }

  if (pool.length === 0) return [];

  const offers: SkillOffer[] = [];
  const used = new Set<string>();
  let safety = count * 12;

  while (offers.length < count && safety-- > 0) {
    const avail = pool.filter((p) => !used.has(p.id));
    if (avail.length === 0) break;
    const picked = rng.weighted(
      avail.map((p) => ({ item: p, weight: p.weight }))
    );
    if (!picked || used.has(picked.id)) continue;
    used.add(picked.id);

    if (picked.kind === "passive") {
      const def = getSkill(picked.id);
      if (!def) continue;
      const cur = player.skills[picked.id] ?? 0;
      offers.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        rarity: def.rarity,
        tags: def.tags,
        desc: def.desc(cur + 1),
        newLevel: cur + 1,
        maxLevel: def.maxLevel,
        isNew: cur === 0,
        kind: "passive",
        fusion: !!def.fusion,
      });
    } else {
      const def = getActiveSkill(picked.id);
      if (!def) continue;
      const cur = player.activeSkills[picked.id] ?? 0;
      offers.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        rarity: def.rarity,
        tags: def.tags,
        desc: def.desc(cur + 1),
        newLevel: cur + 1,
        maxLevel: def.maxLevel,
        isNew: cur === 0,
        kind: "active",
        fusion: !!def.fusion,
      });
    }
  }

  return offers;
}
