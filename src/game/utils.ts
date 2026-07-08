// ============================================================================
// Tiny, dependency-free math + RNG helpers. Kept pure & allocation-light so the
// hot loop can call them without GC pressure.
// ============================================================================

/** Deterministic seeded RNG (mulberry32). Engine owns an instance so a run is
 *  reproducible from its seed, which also makes save/resume behavior stable. */
export class RNG {
  private s: number;

  constructor(seed?: number) {
    let v = seed ?? Math.floor(Math.random() * 0xffffffff);
    v = v >>> 0;
    if (v === 0) v = 0x9e3779b9;
    this.s = v;
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(prob = 0.5): boolean {
    return this.next() < prob;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("RNG.pick: empty array");
    }
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick. Items with weight <= 0 are ignored. */
  weighted<T>(items: ReadonlyArray<{ item: T; weight: number }>): T {
    if (items.length === 0) throw new Error("RNG.weighted: empty array");
    let total = 0;
    for (let i = 0; i < items.length; i++) total += Math.max(0, items[i].weight);
    if (total <= 0) return items[0].item;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, items[i].weight);
      if (r <= 0) return items[i].item;
    }
    return items[items.length - 1].item;
  }
}

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(dist2(ax, ay, bx, by));

/** Move `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number => {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
};

/** Format seconds as M:SS for the HUD. */
export const formatTime = (sec: number): string => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** Safe haptics for Android. No-ops where the Vibration API is unavailable. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}
