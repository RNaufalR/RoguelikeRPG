// ============================================================================
// SAVE SYSTEM. Versioned, defensive localStorage wrapper. Every call is wrapped
// in try/catch so a corrupted/quota-exceeded store can NEVER crash the game —
// worst case it falls back to defaults or a fresh run.
// ============================================================================
import type { PlayerRuntime } from "./types";

export const SAVE_VERSION = 3;

const META_KEY = "rrpg_meta_v3";
const RUN_KEY = "rrpg_run_v3";

export interface MetaSave {
  version: number;
  bestWave: number;
  bestTime: number;
  bestKills: number;
  totalGold: number;
  totalKills: number;
  runs: number;
  settings: {
    sound: boolean;
    haptics: boolean;
    reduceMotion: boolean;
  };
}

export interface RunSnapshot {
  version: number;
  seed: number;
  player: PlayerRuntime;
  wave: number;
  timeSec: number;
  threat: number;
  kills: number;
  gold: number;
}

export function defaultMeta(): MetaSave {
  return {
    version: SAVE_VERSION,
    bestWave: 0,
    bestTime: 0,
    bestKills: 0,
    totalGold: 0,
    totalKills: 0,
    runs: 0,
    settings: { sound: true, haptics: true, reduceMotion: false },
  };
}

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    /* storage full / disabled — ignore, game still runs */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function isValidMeta(data: unknown): data is MetaSave {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.bestWave === "number" &&
    typeof d.settings === "object" &&
    d.settings !== null
  );
}

export function loadMeta(): MetaSave {
  const raw = safeGet(META_KEY);
  if (!raw) return defaultMeta();
  try {
    const parsed = JSON.parse(raw);
    if (!isValidMeta(parsed)) return defaultMeta();
    const base = defaultMeta();
    // Merge so new fields always have sane defaults even on old saves.
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      version: SAVE_VERSION,
    };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaSave): void {
  safeSet(META_KEY, JSON.stringify({ ...meta, version: SAVE_VERSION }));
}

export function loadRun(): RunSnapshot | null {
  const raw = safeGet(RUN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RunSnapshot;
    if (
      parsed.version !== SAVE_VERSION ||
      !parsed.player ||
      typeof parsed.player.hp !== "number" ||
      typeof parsed.wave !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRun(snap: RunSnapshot): void {
  safeSet(RUN_KEY, JSON.stringify(snap));
}

export function clearRun(): void {
  safeRemove(RUN_KEY);
}

export function hasRun(): boolean {
  return loadRun() !== null;
}
