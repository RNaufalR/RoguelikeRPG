// ============================================================================
// GAME ENGINE
// Single authoritative owner of all mutable state. Runs a clamped-delta rAF
// loop. Canvas rendering in world space with a follow camera; React only reads
// a throttled UISnapshot and writes raw input — so the hot loop never triggers
// a React re-render.
//
// Internal sections (search to navigate):
//   LIFECYCLE  • PUBLIC API  • INPUT  • LOOP  • UPDATE  • COMBAT
//   SPAWNING   • DIFFICULTY  • POOLS  • RENDER  • SNAPSHOT
// ============================================================================
import type {
  ActiveEffect,
  ActiveSkillEngineApi,
  EffectSpec,
  Enemy,
  EnemyDef,
  Familiar,
  FloatingText,
  Pickup,
  PickupType,
  PlayerRuntime,
  Projectile,
  SkillOffer,
  UISnapshot,
  EngineApi,
} from "./types";
import { CONFIG } from "./config";
import { RNG, clamp, dist2 } from "./utils";
import { getSkill } from "./data/skills";
import { draftOffers } from "./data/draft";
import { activeCost, getActiveSkill } from "./data/activeSkills";
import { applyEquipment, getEquipment } from "./data/equipment";
import type { EquipSlot } from "./types";
import {
  getEnemy,
  pickBossDefId,
  pickEnemyDefId,
} from "./data/enemies";
import { rollBossLoot, rollEnemyLoot } from "./data/items";
import { SoundManager } from "./sfx";
import {
  SAVE_VERSION,
  clearRun,
  loadMeta,
  saveMeta,
  saveRun,
  type RunSnapshot,
} from "./save";

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  t: number;
}

export interface EngineOptions {
  sound?: boolean;
}

export class Engine implements EngineApi, ActiveSkillEngineApi {
  // --- canvas / view ---
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;
  private destroyed = false;

  // --- loop ---
  private raf = 0;
  private lastTime: number | undefined = undefined;
  private fps = 60;
  private uiAccum = 0;
  private lastUiPhase: UISnapshot["phase"] = "menu";

  // --- rng / world ---
  private rng = new RNG();
  private seed = 0;

  // --- entities ---
  private player: PlayerRuntime = this.createPlayer();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private texts: FloatingText[] = [];
  private shockwaves: Shockwave[] = [];
  private familiars: Familiar[] = [];
  private effects: ActiveEffect[] = [];
  private nextUid = 1;
  private deadProcessed = new Set<number>();

  // --- progression / difficulty ---
  private wave = 1;
  private waveTimer = 0;
  private timeSec = 0;
  private threat = 0;
  private spawnTimer = 1;
  private bossRef: Enemy | null = null;
  private activeTimers: Record<string, number> = {};

  // --- level up flow ---
  private pendingLevels = 0;
  private offers: SkillOffer[] = [];

  // --- misc runtime ---
  private regenAccum = 0;
  private camShake = 0;
  private lastSave = 0;

  // --- input ---
  private touchMove = { x: 0, y: 0, active: false };
  private keyMove = { x: 0, y: 0 };
  private keys = new Set<string>();
  private dashQueued = false;

  // --- state ---
  private phase: UISnapshot["phase"] = "menu";
  private listeners = new Set<(s: UISnapshot) => void>();

  // --- audio ---
  sfx = new SoundManager();

  constructor(canvas: HTMLCanvasElement, options?: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D context is not supported on this device.");
    this.ctx = ctx;
    if (options?.sound === false) this.sfx.setMuted(true);
    this.ensureSize();
    this.bindInput();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  start(seed?: number): void {
    this.seed = (seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    this.rng = new RNG(this.seed);
    this.player = this.createPlayer();
    this.resetWorld();
    this.wave = 1;
    this.waveTimer = 0;
    this.timeSec = 0;
    this.threat = 0;
    this.spawnTimer = 1;
    this.bossRef = null;
    this.pendingLevels = 0;
    this.offers = [];
    this.regenAccum = 0;
    this.camShake = 0;
    this.activeTimers = {};
    this.resetInput();
    this.phase = "playing";
    this.lastTime = undefined;
    this.ensureSize();
    this.emitUI();
    this.saveRunDebounced();
  }

  loadRun(snap: RunSnapshot): void {
    try {
      this.seed = snap.seed >>> 0;
      this.rng = new RNG(this.seed);
      const base = this.createPlayer();
      this.player = { ...base, ...snap.player };
      // Defensive: ensure nested objects always exist.
      this.player.skills = snap.player.skills ? { ...snap.player.skills } : {};
      this.player.activeSkills = snap.player.activeSkills
        ? { ...snap.player.activeSkills }
        : {};
      // Restore equipment loadout tracking (stat bonuses are already baked
      // into the serialized numbers, so we do NOT re-apply here).
      this.player.ownedEquipment = Array.isArray(snap.player.ownedEquipment)
        ? [...snap.player.ownedEquipment]
        : [];
      this.player.equipped = snap.player.equipped ? { ...snap.player.equipped } : {};
      if (!isFinite(this.player.hp)) this.player.hp = this.player.maxHp;
      this.resetWorld();
      // Rebuild active-skill cooldown timers from owned levels (derived state).
      this.activeTimers = {};
      for (const id in this.player.activeSkills) {
        const def = getActiveSkill(id);
        if (def) this.activeTimers[id] = def.cooldown(this.player.activeSkills[id] ?? 1);
      }
      // Rebuild familiars from count (they are derived, not serialized).
      for (let i = 0; i < this.player.familiarCount; i++) {
        this.familiars.push({
          x: this.player.x,
          y: this.player.y,
          angle: i,
          cooldown: 0,
        });
      }
      this.wave = snap.wave || 1;
      this.waveTimer = 0;
      this.timeSec = snap.timeSec || 0;
      this.threat = snap.threat || 0;
      this.spawnTimer = 0.6;
      this.bossRef = null;
      this.pendingLevels = 0;
      this.offers = [];
      this.regenAccum = 0;
      this.camShake = 0;
      this.resetInput();
      this.phase = "playing";
      this.lastTime = undefined;
      this.ensureSize();
      this.emitUI();
    } catch (err) {
      console.warn("[Engine] loadRun failed, starting fresh:", err);
      this.start();
    }
  }

  private resetWorld(): void {
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.texts = [];
    this.shockwaves = [];
    this.familiars = [];
    this.effects = [];
    this.nextUid = 1;
    this.deadProcessed.clear();
  }

  private resetInput(): void {
    this.touchMove = { x: 0, y: 0, active: false };
    this.keyMove = { x: 0, y: 0 };
    this.keys.clear();
    this.dashQueued = false;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    try {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      document.removeEventListener("visibilitychange", this.onVisibility);
      window.removeEventListener("blur", this.onBlur);
    } catch {
      /* ignore */
    }
    this.listeners.clear();
  }

  // ==========================================================================
  // PUBLIC API (called by React)
  // ==========================================================================
  beginLoop(): void {
    if (this.raf) return;
    this.lastTime = undefined;
    this.raf = requestAnimationFrame(this.loop);
  }

  subscribe(fn: (s: UISnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  setMove(dx: number, dy: number, active: boolean): void {
    this.touchMove.x = dx;
    this.touchMove.y = dy;
    this.touchMove.active = active;
  }

  triggerDash(): void {
    if (this.phase === "playing") this.dashQueued = true;
  }

  chooseSkill(id: string): void {
    if (this.phase !== "levelup") return;
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return;
    const p = this.player;

    if (offer.kind === "active") {
      const adef = getActiveSkill(id);
      if (!adef) return;
      const level = (p.activeSkills[id] ?? 0) + 1;
      p.activeSkills[id] = level;
      this.activeTimers[id] = adef.cooldown(level);
    } else {
      const def = getSkill(id);
      if (!def) return;
      const level = (p.skills[id] ?? 0) + 1;
      p.skills[id] = level;
      def.apply({ player: p, engine: this, level });
      if (p.hp > p.maxHp) p.hp = p.maxHp;
    }
    this.sfx.play("levelup");

    if (this.pendingLevels > 0) this.pendingLevels -= 1;
    if (this.pendingLevels > 0) {
      this.offers = draftOffers(p, this.rng, 3);
      if (this.offers.length === 0) {
        // Everything maxed — give a consolation and continue.
        this.healPlayer(p.maxHp * 0.2);
        this.pendingLevels = 0;
        this.resumePlay();
      } else {
        this.emitUI();
      }
    } else {
      this.resumePlay();
    }
  }

  private resumePlay(): void {
    this.offers = [];
    this.phase = "playing";
    this.lastTime = undefined;
    this.emitUI();
    this.saveRunDebounced();
  }

  pause(): void {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.emitUI();
      this.saveRunDebounced();
    }
  }

  resume(): void {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.lastTime = undefined;
      this.emitUI();
    }
  }

  togglePause(): void {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  setMuted(m: boolean): void {
    this.sfx.setMuted(m);
  }

  // EngineApi: summoned familiars register here.
  addFamiliar(): void {
    if (this.familiars.length < 8) {
      this.familiars.push({
        x: this.player.x,
        y: this.player.y,
        angle: this.familiars.length,
        cooldown: 0,
      });
    }
  }

  // EngineApi: floating combat text.
  spawnText(x: number, y: number, text: string, color: string, size = 13): void {
    const t = this.acquireText();
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = -34;
    t.life = 0.8;
    t.maxLife = 0.8;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  // ==========================================================================
  // ACTIVE SKILLS + EFFECTS (ActiveSkillEngineApi impl + simulation)
  // ==========================================================================
  getEnemies(): readonly Enemy[] {
    return this.enemies;
  }

  playerX(): number {
    return this.player.x;
  }

  playerY(): number {
    return this.player.y;
  }

  facing(): { x: number; y: number } {
    return { x: this.player.facingX, y: this.player.facingY };
  }

  /** ActiveSkillEngineApi: spawn a transient combat effect (pooled). */
  spawnEffect(spec: EffectSpec): void {
    const e = this.acquireEffect();
    if (!e) return;
    e.active = true;
    e.kind = spec.kind;
    e.x = spec.x;
    e.y = spec.y;
    e.vx = spec.vx ?? 0;
    e.vy = spec.vy ?? 0;
    e.radius = Math.max(2, spec.radius);
    e.damage = spec.damage;
    e.life = spec.life;
    e.maxLife = spec.life;
    e.tickRate = spec.tickRate ?? 0.2;
    e.tick = 0; // first tick fires immediately
    e.angle = spec.angle ?? 0;
    e.spin = spec.spin ?? 0;
    e.color = spec.color;
    e.width = spec.width ?? 20;
    e.count = spec.count ?? 0;
    e.warn = spec.warn ?? 0;
    e.followPlayer = !!spec.followPlayer;
    e.struck = false;
    e.points.length = 0;
    e.hit.clear();
  }

  /** Purchase / upgrade a mythic active skill with gold. Returns success. */
  buyActiveSkill(id: string): boolean {
    const def = getActiveSkill(id);
    if (!def || !def.mythic) return false;
    const p = this.player;
    const cur = p.activeSkills[id] ?? 0;
    if (cur >= def.maxLevel) return false;
    const cost = activeCost(def, cur);
    if (p.gold < cost) return false;
    p.gold -= cost;
    p.activeSkills[id] = cur + 1;
    this.activeTimers[id] = def.cooldown(cur + 1) * 0.4;
    this.sfx.play("levelup");
    this.spawnText(p.x, p.y - 26, "MYTHIC!", "#fbbf24", 15);
    this.emitUI();
    return true;
  }

  /** Purchase a piece of equipment with gold. Applies its stat bonus exactly
   *  once and records ownership + slot equip. Returns success. */
  buyEquipment(id: string): boolean {
    const def = getEquipment(id);
    if (!def) return false;
    const p = this.player;
    if (p.ownedEquipment.includes(id)) return false;
    if (p.gold < def.cost) return false;
    p.gold -= def.cost;
    applyEquipment(p, def);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    p.ownedEquipment.push(id);
    p.equipped[def.slot as EquipSlot] = id;
    this.sfx.play("pickup");
    this.spawnText(p.x, p.y - 26, def.name, "#fbbf24", 13);
    this.emitUI();
    return true;
  }

  /** Endless zone name based on wave (cycles forever as you descend). */
  zoneName(): string {
    const zones = CONFIG.zones;
    const depth = Math.floor((Math.max(1, this.wave) - 1) / CONFIG.zoneDepthEvery) + 1;
    const idx = (depth - 1) % zones.length;
    return `${zones[idx]} · D${depth}`;
  }

  private hasLiveEnemy(): boolean {
    for (const e of this.enemies) if (e.hp > 0) return true;
    return false;
  }

  /** Tick every owned active skill's cooldown and auto-fire when ready. */
  private updateActiveSkills(dt: number): void {
    const p = this.player;
    const owned = p.activeSkills;
    for (const id in owned) {
      const def = getActiveSkill(id);
      if (!def) continue;
      let t = (this.activeTimers[id] ?? 0) - dt;
      if (t <= 0) {
        // Don't burn a long cooldown with no targets on screen.
        if (!this.hasLiveEnemy()) {
          this.activeTimers[id] = 0.4;
          continue;
        }
        const level = owned[id] ?? 1;
        t = def.cooldown(level);
        def.fire({ engine: this, player: p, level });
      }
      this.activeTimers[id] = t;
    }
  }

  private updateActiveEffects(dt: number): void {
    const p = this.player;
    for (const e of this.effects) {
      if (!e.active) continue;
      if (e.followPlayer) {
        e.x = p.x;
        e.y = p.y;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle += e.spin * dt;
      e.life -= dt;
      e.tick -= dt;

      if (e.kind === "lightning") {
        if (!e.struck) {
          e.struck = true;
          this.lightningChain(e);
        }
      } else if (e.kind === "meteor") {
        if (e.warn > 0) {
          e.warn -= dt;
          if (e.warn <= 0 && !e.struck) {
            e.struck = true;
            this.meteorStrike(e);
          }
        }
      } else if (e.tick <= 0) {
        e.tick = e.tickRate;
        e.hit.clear();
        this.effectTickDamage(e, dt);
      }

      if (e.life <= 0) e.active = false;
    }
  }

  private effectTickDamage(e: ActiveEffect, dt: number): void {
    const r2 = e.radius * e.radius;
    switch (e.kind) {
      case "blizzard": {
        for (const en of this.enemies) {
          if (en.hp <= 0) continue;
          if (dist2(en.x, en.y, e.x, e.y) <= r2) {
            this.damageEnemy(en, e.damage, false, e.x, e.y);
            en.slowTimer = 0.6;
            en.slowFactor = Math.max(en.slowFactor, 0.55);
          }
        }
        break;
      }
      case "laser": {
        const len = e.radius;
        const halfW = e.width;
        const dirx = Math.cos(e.angle);
        const diry = Math.sin(e.angle);
        for (const en of this.enemies) {
          if (en.hp <= 0) continue;
          const rx = en.x - e.x;
          const ry = en.y - e.y;
          const proj = rx * dirx + ry * diry;
          if (proj < -10 || proj > len) continue;
          const perp = Math.abs(rx * diry - ry * dirx);
          if (perp <= halfW + en.radius) {
            this.damageEnemy(en, e.damage, false, e.x, e.y);
          }
        }
        break;
      }
      case "tornado": {
        for (const en of this.enemies) {
          if (en.hp <= 0) continue;
          const d2 = dist2(en.x, en.y, e.x, e.y);
          if (d2 <= r2) {
            this.damageEnemy(en, e.damage, false, e.x, e.y);
            const d = Math.sqrt(d2) || 1;
            const pull = 95 * dt;
            en.x += ((e.x - en.x) / d) * pull;
            en.y += ((e.y - en.y) / d) * pull;
          }
        }
        break;
      }
      case "blackhole": {
        const innerR2 = 46 * 46;
        for (const en of this.enemies) {
          if (en.hp <= 0) continue;
          const d2 = dist2(en.x, en.y, e.x, e.y);
          if (d2 <= r2) {
            const d = Math.sqrt(d2) || 1;
            const pull = 165 * dt;
            en.x += ((e.x - en.x) / d) * pull;
            en.y += ((e.y - en.y) / d) * pull;
            if (d2 <= innerR2) this.damageEnemy(en, e.damage, false, e.x, e.y);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private lightningChain(e: ActiveEffect): void {
    const points = e.points;
    points.length = 0;
    points.push({ x: e.x, y: e.y });
    const chained = new Set<number>();
    let cx = e.x;
    let cy = e.y;
    const range2 = e.radius * e.radius;
    for (let i = 0; i < e.count; i++) {
      let best: Enemy | null = null;
      let bd = range2;
      for (const en of this.enemies) {
        if (en.hp <= 0 || chained.has(en.uid)) continue;
        const d = dist2(en.x, en.y, cx, cy);
        if (d < bd) {
          bd = d;
          best = en;
        }
      }
      if (!best) break;
      chained.add(best.uid);
      points.push({ x: best.x, y: best.y });
      this.damageEnemy(best, e.damage, this.rng.bool(0.3), e.x, e.y);
      cx = best.x;
      cy = best.y;
    }
  }

  private meteorStrike(e: ActiveEffect): void {
    const r2 = e.radius * e.radius;
    for (const en of this.enemies) {
      if (en.hp <= 0) continue;
      if (dist2(en.x, en.y, e.x, e.y) <= r2) {
        this.damageEnemy(en, e.damage, true, e.x, e.y);
      }
    }
    this.shockwaves.push({ x: e.x, y: e.y, r: 0, maxR: e.radius, t: 0 });
    this.camShake = Math.min(10, this.camShake + 5);
    this.sfx.play("boss");
  }

  private acquireEffect(): ActiveEffect | null {
    for (let i = 0; i < this.effects.length; i++) {
      if (!this.effects[i].active) return this.effects[i];
    }
    if (this.effects.length < CONFIG.maxEffects) {
      const e: ActiveEffect = {
        active: false,
        kind: "blizzard",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        damage: 0,
        life: 0,
        maxLife: 0,
        tick: 0,
        tickRate: 0.2,
        angle: 0,
        spin: 0,
        color: "#fff",
        width: 20,
        count: 0,
        warn: 0,
        followPlayer: false,
        struck: false,
        points: [],
        hit: new Set<number>(),
      };
      this.effects.push(e);
      return e;
    }
    return null;
  }

  // ==========================================================================
  // INPUT
  // ==========================================================================
  private bindInput(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === "escape" || k === "p") {
      this.togglePause();
      return;
    }
    if (k === " " || k === "shift") {
      e.preventDefault();
      this.triggerDash();
    }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      this.updateKeyMove();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    this.updateKeyMove();
  };

  private updateKeyMove(): void {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    this.keyMove = { x, y };
  }

  private onVisibility = (): void => {
    if (document.hidden) this.pause();
  };

  private onBlur = (): void => {
    this.pause();
  };

  // ==========================================================================
  // LOOP
  // ==========================================================================
  private loop = (now: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);

    const last = this.lastTime ?? now;
    let dt = (now - last) / 1000;
    this.lastTime = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > CONFIG.maxDt) dt = CONFIG.maxDt;
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08;

    this.ensureSize();

    if (this.phase === "playing") {
      this.update(dt);
    }
    this.render();

    this.uiAccum += dt;
    if (this.uiAccum >= CONFIG.uiUpdateInterval || this.phase !== this.lastUiPhase) {
      this.uiAccum = 0;
      this.lastUiPhase = this.phase;
      this.emitUI();
    }
  };

  private update(dt: number): void {
    this.updatePlayer(dt);
    this.updateActiveSkills(dt);
    this.updateFamiliars(dt);
    this.updateFrostAura(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateActiveEffects(dt);
    this.updatePickups(dt);
    this.updateShockwaves(dt);
    this.updateTexts(dt);
    this.updateSpawn(dt);
    this.updateDifficulty(dt);
    this.compactDead();
  }

  // ==========================================================================
  // UPDATE — PLAYER
  // ==========================================================================
  private updatePlayer(dt: number): void {
    const p = this.player;
    const b = CONFIG.player;

    // Resolve input (touch wins over keyboard).
    let mx: number;
    let my: number;
    if (this.touchMove.active) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    } else {
      mx = this.keyMove.x;
      my = this.keyMove.y;
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    // Dash request.
    if (this.dashQueued && p.hasDash && p.dashTimer <= 0 && p.dashActive <= 0) {
      let dx = mx;
      let dy = my;
      if (mag < 0.1) {
        dx = p.facingX;
        dy = p.facingY;
      }
      const dm = Math.hypot(dx, dy) || 1;
      p.facingX = dx / dm;
      p.facingY = dy / dm;
      p.dashActive = p.dashDuration;
      p.dashTimer = p.dashCooldown;
      p.invuln = Math.max(p.invuln, p.dashDuration + 0.06);
      this.sfx.play("dash");
      this.spawnText(p.x, p.y - 22, "DASH", "#7dd3fc", 13);
    }
    this.dashQueued = false;

    if (p.dashTimer > 0) p.dashTimer -= dt;

    let speed = p.moveSpeed;
    if (p.dashActive > 0) {
      p.dashActive -= dt;
      speed *= b.dashSpeedMult;
      p.invuln = Math.max(p.invuln, 0.04);
    }

    p.vx = mx * speed;
    p.vy = my * speed;
    p.x = clamp(p.x + p.vx * dt, 14, CONFIG.arenaW - 14);
    p.y = clamp(p.y + p.vy * dt, 14, CONFIG.arenaH - 14);
    if (mag > 0.1) {
      p.facingX = mx / mag;
      p.facingY = my / mag;
    }

    if (p.invuln > 0) p.invuln -= dt;

    // HP regen (accumulate to avoid float drift).
    if (p.hpRegen > 0 && p.hp < p.maxHp) {
      this.regenAccum += p.hpRegen * dt;
      if (this.regenAccum >= 1) {
        const heal = Math.floor(this.regenAccum);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.regenAccum -= heal;
      }
    }

    // Auto-attack toward nearest enemy.
    p.attackTimer -= dt;
    if (p.attackTimer <= 0) {
      p.attackTimer = 1 / Math.max(0.1, p.attackSpeed);
      this.firePlayerWeapon();
    }
  }

  private firePlayerWeapon(): void {
    const p = this.player;
    const target = this.nearestEnemy(p.x, p.y, 820);
    if (!target) return;

    const baseAng = Math.atan2(target.y - p.y, target.x - p.x);
    const count = p.projectileCount;
    const spread = count > 1 ? 0.16 : 0;
    const start = baseAng - (spread * (count - 1)) / 2;
    for (let i = 0; i < count; i++) {
      const a = start + spread * i;
      const crit = this.rng.bool(p.critChance);
      const dmg = p.damage * (crit ? p.critMult : 1);
      this.spawnProjectile({
        x: p.x,
        y: p.y,
        angle: a,
        speed: p.projectileSpeed,
        damage: dmg,
        radius: p.projectileRadius * p.areaMult,
        pierce: p.projectilePierce,
        fromPlayer: true,
        color: crit ? "#fde047" : CONFIG.colors.projectile,
        crit,
      });
    }
    if (this.rng.bool(0.5)) this.sfx.play("shoot");
  }

  // ==========================================================================
  // UPDATE — FAMILIARS / FROST AURA
  // ==========================================================================
  private updateFamiliars(dt: number): void {
    const p = this.player;
    const n = this.familiars.length;
    if (n === 0) return;
    const orbitR = 48;
    const k = Math.min(1, dt * 10);
    for (let i = 0; i < n; i++) {
      const f = this.familiars[i];
      f.angle += dt * 1.7;
      const offset = (i / n) * Math.PI * 2;
      const tx = p.x + Math.cos(f.angle + offset) * orbitR;
      const ty = p.y + Math.sin(f.angle + offset) * orbitR;
      f.x += (tx - f.x) * k;
      f.y += (ty - f.y) * k;
      f.cooldown -= dt;
      if (f.cooldown <= 0) {
        const tgt = this.nearestEnemy(f.x, f.y, 540);
        if (tgt) {
          f.cooldown = CONFIG.player.familiarCooldown;
          const a = Math.atan2(tgt.y - f.y, tgt.x - f.x);
          this.spawnProjectile({
            x: f.x,
            y: f.y,
            angle: a,
            speed: 380,
            damage: p.familiarDamage,
            radius: 5,
            pierce: 0,
            fromPlayer: true,
            color: "#a5f3fc",
            crit: false,
          });
        }
      }
    }
  }

  private updateFrostAura(_dt: number): void {
    const p = this.player;
    if (p.frostAuraRadius <= 0) return;
    const r2 = p.frostAuraRadius * p.frostAuraRadius;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (dist2(e.x, e.y, p.x, p.y) <= r2) {
        e.slowTimer = 0.3;
        e.slowFactor = Math.max(e.slowFactor, p.frostAuraSlow);
      }
    }
  }

  // ==========================================================================
  // UPDATE — ENEMIES (AI)
  // ==========================================================================
  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.spawnAnim > 0) e.spawnAnim -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.contactCd > 0) e.contactCd -= dt;
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) e.slowFactor = 0;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const dirx = dx / d;
      const diry = dy / d;

      let mvx = dirx;
      let mvy = diry;
      if (e.behavior === "ranged") {
        const desired = e.attackRange;
        if (d < desired - 24) {
          mvx = -dirx;
          mvy = -diry;
        } else if (d < desired + 24) {
          mvx = 0;
          mvy = 0;
        }
      }

      const sp = e.speed * (1 - e.slowFactor);
      e.x = clamp(e.x + mvx * sp * dt, 8, CONFIG.arenaW - 8);
      e.y = clamp(e.y + mvy * sp * dt, 8, CONFIG.arenaH - 8);

      // Ranged / boss attacks.
      if (e.behavior === "ranged" || e.isBoss) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && d < e.attackRange + 40 && d > 1) {
          e.attackTimer = e.attackInterval;
          const a = Math.atan2(dy, dx);
          if (e.isBoss) this.bossAttack(e, a);
          else {
            this.spawnProjectile({
              x: e.x,
              y: e.y,
              angle: a,
              speed: 260,
              damage: e.damage,
              radius: 7,
              pierce: 0,
              fromPlayer: false,
              color: CONFIG.colors.enemyProj,
              crit: false,
            });
          }
        }
      }

      // Contact damage (melee + bosses).
      const reach = e.radius + 12;
      if (d < reach) this.contactDamagePlayer(e);

      // Boss special moves.
      if (e.isBoss) {
        e.specialTimer -= dt;
        if (e.specialTimer <= 0) {
          e.specialTimer = 2.6 + this.rng.range(0, 1.6);
          this.bossSpecial(e);
        }
      }
    }
  }

  private bossAttack(e: Enemy, baseAng: number): void {
    const burst = e.defId === "boss_sentinel" ? 2 : e.defId === "boss_lich" ? 1 : 0;
    for (let i = 0; i < burst; i++) {
      const off = (i - (burst - 1) / 2) * 0.26;
      this.spawnProjectile({
        x: e.x,
        y: e.y,
        angle: baseAng + off,
        speed: 300,
        damage: e.damage,
        radius: 9,
        pierce: 0,
        fromPlayer: false,
        color: e.color,
        crit: false,
      });
    }
  }

  private bossSpecial(e: Enemy): void {
    const p = this.player;
    if (e.defId === "boss_lich") {
      const n = 10;
      for (let i = 0; i < n; i++) {
        this.spawnProjectile({
          x: e.x,
          y: e.y,
          angle: (i / n) * Math.PI * 2,
          speed: 250,
          damage: e.damage * 0.8,
          radius: 8,
          pierce: 1,
          fromPlayer: false,
          color: "#c084fc",
          crit: false,
        });
      }
    } else if (e.defId === "boss_sentinel") {
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 0; i < 5; i++) {
        this.spawnProjectile({
          x: e.x,
          y: e.y,
          angle: base + (i - 2) * 0.3,
          speed: 340,
          damage: e.damage,
          radius: 8,
          pierce: 0,
          fromPlayer: false,
          color: "#fb7185",
          crit: false,
        });
      }
    } else {
      // Behemoth: radial shockwave.
      this.shockwaves.push({ x: e.x, y: e.y, r: 0, maxR: 165, t: 0 });
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < 165) this.damagePlayer(e.damage * 0.7, e.x, e.y);
    }
  }

  // ==========================================================================
  // COMBAT
  // ==========================================================================
  private contactDamagePlayer(e: Enemy): void {
    const p = this.player;
    if (p.invuln > 0 || e.contactCd > 0) return;
    e.contactCd = 0.6;
    this.damagePlayer(e.damage, e.x, e.y);
    if (p.thorns > 0) this.damageEnemy(e, p.thorns, false, p.x, p.y);
  }

  private damagePlayer(raw: number, srcX: number, srcY: number): void {
    const p = this.player;
    if (p.invuln > 0 || this.phase !== "playing") return;
    void srcX;
    void srcY;
    const dmg = Math.max(1, raw - p.armor);
    p.hp -= dmg;
    p.invuln = CONFIG.player.invulnTime;
    this.camShake = Math.min(9, this.camShake + 3.5);
    this.spawnText(p.x, p.y - 20, "-" + Math.round(dmg), CONFIG.colors.danger, 14);
    this.sfx.play("hurt");
    if (p.hp <= 0) {
      p.hp = 0;
      this.endGame();
    }
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, _sx: number, _sy: number): void {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hitFlash = 0.08;
    if (this.player.lifesteal > 0) this.healPlayer(this.player.lifesteal * dmg);
    if (crit || this.rng.bool(0.22)) {
      this.spawnText(e.x, e.y - e.radius, Math.round(dmg).toString(), crit ? "#fde047" : "#e2e8f0", crit ? 16 : 11);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private healPlayer(amount: number): void {
    if (amount <= 0) return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
  }

  private killEnemy(e: Enemy): void {
    if (this.deadProcessed.has(e.uid)) return;
    this.deadProcessed.add(e.uid);
    e.hp = -1; // sentinel so AI/collision skip it this frame

    // Rewards are delivered 100% via pickups so magnet / pickup radius /
    // Scholar / Greed all interact correctly. No duplicate direct addXp.
    const loot = e.isBoss
      ? rollBossLoot(this.rng, this.wave, e.xpReward, e.goldReward)
      : rollEnemyLoot(this.rng, this.wave, e.xpReward, e.goldReward);
    for (const l of loot) this.spawnPickup(l.type, e.x, e.y, l.value);

    this.player.kills += 1;
    if (this.rng.bool(0.18)) this.sfx.play("hit");

    if (e.isBoss) {
      this.bossRef = null;
      this.healPlayer(this.player.maxHp * 0.15);
      this.camShake = 8;
      this.spawnText(this.player.x, this.player.y - 40, "BOSS DEFEATED!", "#fbbf24", 18);
    }
  }

  private compactDead(): void {
    if (this.deadProcessed.size === 0) return;
    const arr = this.enemies;
    let w = 0;
    for (let r = 0; r < arr.length; r++) {
      if (arr[r].hp > 0) arr[w++] = arr[r];
    }
    arr.length = w;
    this.deadProcessed.clear();
  }

  // ==========================================================================
  // UPDATE — PROJECTILES
  // ==========================================================================
  private updateProjectiles(dt: number): void {
    const p = this.player;
    const aw = CONFIG.arenaW;
    const ah = CONFIG.arenaH;
    for (const pr of this.projectiles) {
      if (!pr.active) continue;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || pr.x < -40 || pr.y < -40 || pr.x > aw + 40 || pr.y > ah + 40) {
        pr.active = false;
        pr.hit = undefined;
        continue;
      }
      if (pr.fromPlayer) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (pr.hit && pr.hit.has(e.uid)) continue;
          const rr = e.radius + pr.radius;
          if (dist2(pr.x, pr.y, e.x, e.y) <= rr * rr) {
            this.damageEnemy(e, pr.damage, pr.crit, pr.x, pr.y);
            if (pr.pierce > 0) {
              if (pr.hit) pr.hit.add(e.uid);
              pr.pierce -= 1;
            } else {
              pr.active = false;
              pr.hit = undefined;
              break;
            }
          }
        }
      } else {
        const rr = 12 + pr.radius;
        if (dist2(pr.x, pr.y, p.x, p.y) <= rr * rr) {
          this.damagePlayer(pr.damage, pr.x, pr.y);
          pr.active = false;
          pr.hit = undefined;
        }
      }
    }
  }

  // ==========================================================================
  // UPDATE — PICKUPS
  // ==========================================================================
  private updatePickups(dt: number): void {
    const p = this.player;
    const pr2 = p.pickupRadius;
    for (const pk of this.pickups) {
      if (!pk.active) continue;
      pk.bob += dt;
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      const magnetR = pk.type === "xp" || pk.type === "gold" ? pr2 : 46;
      if (!pk.magnet && d2 < magnetR * magnetR) pk.magnet = true;
      if (pk.magnet) {
        const d = Math.sqrt(d2) || 1;
        const sp = CONFIG.pickup.magnetSpeed;
        pk.x += ((p.x - pk.x) / d) * sp * dt;
        pk.y += ((p.y - pk.y) / d) * sp * dt;
      }
      if (d2 < 12 * 12) {
        this.collectPickup(pk);
        pk.active = false;
      }
    }
  }

  private collectPickup(pk: Pickup): void {
    const p = this.player;
    switch (pk.type) {
      case "xp":
        this.addXp(pk.value);
        break;
      case "gold":
        this.addGold(pk.value);
        this.sfx.play("pickup");
        break;
      case "heal":
        this.healPlayer(pk.value);
        this.spawnText(p.x, p.y - 22, "+" + pk.value, CONFIG.colors.heal, 14);
        this.sfx.play("pickup");
        break;
      case "chest":
        this.openChest();
        break;
    }
  }

  private openChest(): void {
    this.sfx.play("levelup");
    this.spawnText(this.player.x, this.player.y - 30, "TREASURE!", "#c4b5fd", 18);
    this.pendingLevels += 1;
    if (this.phase === "playing") this.enterLevelUp();
  }

  private addXp(amount: number): void {
    const p = this.player;
    p.xp += amount * (1 + p.bonusXp);
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = this.xpForLevel(p.level);
      this.pendingLevels += 1;
    }
    if (this.pendingLevels > 0 && this.phase === "playing") this.enterLevelUp();
  }

  private addGold(amount: number): void {
    this.player.gold += Math.max(0, amount * (1 + this.player.bonusGold));
  }

  private enterLevelUp(): void {
    if (this.phase !== "playing") return;
    this.phase = "levelup";
    this.offers = draftOffers(this.player, this.rng, 3);
    if (this.offers.length === 0) {
      this.healPlayer(this.player.maxHp * 0.25);
      this.addGold(25);
      this.pendingLevels = 0;
      this.phase = "playing";
    } else {
      this.sfx.play("levelup");
    }
    this.emitUI();
  }

  private endGame(): void {
    if (this.phase === "gameover") return;
    this.player.hp = 0;
    this.phase = "gameover";
    this.sfx.play("death");
    this.saveMetaAfterRun();
    clearRun();
    this.emitUI();
  }

  // ==========================================================================
  // SPAWNING
  // ==========================================================================
  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist * maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private updateSpawn(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const cfg = CONFIG.spawn;
    this.spawnTimer = Math.max(cfg.minInterval, cfg.baseInterval - this.wave * cfg.intervalPerWave);
    const desired = Math.round(cfg.baseCount + this.wave * cfg.countPerWave);
    const room = CONFIG.maxEnemies - this.enemies.length;
    const toSpawn = Math.max(0, Math.min(desired, room));
    for (let i = 0; i < toSpawn; i++) this.spawnEnemyAtEdge();
  }

  private spawnEnemyAtEdge(): void {
    const defId = pickEnemyDefId(this.wave, this.rng);
    const def = getEnemy(defId);
    if (!def) return;
    const ang = this.rng.range(0, Math.PI * 2);
    const distFromPlayer = Math.max(this.viewW, this.viewH) / 2 + CONFIG.spawn.spawnMargin;
    const x = clamp(this.player.x + Math.cos(ang) * distFromPlayer, 16, CONFIG.arenaW - 16);
    const y = clamp(this.player.y + Math.sin(ang) * distFromPlayer, 16, CONFIG.arenaH - 16);
    const elite =
      !def.isBoss &&
      this.wave >= 3 &&
      this.rng.bool(
        CONFIG.difficulty.eliteChanceBase + this.wave * CONFIG.difficulty.eliteChancePerWave
      );
    this.spawnEnemy(def, x, y, elite);
  }

  private spawnEnemy(
    def: EnemyDef,
    x: number,
    y: number,
    elite: boolean,
    boostHp = 1,
    boostDmg = 1,
    namePrefix = ""
  ): void {
    if (!def.isBoss && this.enemies.length >= CONFIG.maxEnemies) return;
    const d = CONFIG.difficulty;
    const hpMult =
      (1 + this.wave * d.hpPerWave + this.threat * d.hpPerThreat) * (elite ? 3 : 1) * boostHp;
    const dmgMult =
      (1 + this.wave * d.dmgPerWave + this.threat * d.dmgPerThreat) * (elite ? 1.4 : 1) * boostDmg;
    const spdMult = (1 + this.wave * d.speedPerWave) * (elite ? 0.85 : 1);
    // Rewards scale WITH difficulty — tougher waves pay out more so level-ups
    // keep up with enemy HP. Elites still grant a premium.
    const rewardMult =
      (1 + this.wave * 0.16 + this.threat * 0.45) * (elite ? 3 : 1) * (def.isBoss ? 1.15 : 1);
    const goldMult =
      (1 + this.wave * 0.10 + this.threat * 0.30) * (elite ? 3 : 1) * (def.isBoss ? 1.1 : 1);

    const e: Enemy = {
      uid: this.nextUid++,
      defId: def.id,
      behavior: def.behavior,
      name: namePrefix + def.name + (elite ? " (Elite)" : ""),
      x,
      y,
      vx: 0,
      vy: 0,
      hp: def.baseHp * hpMult,
      maxHp: def.baseHp * hpMult,
      speed: def.baseSpeed * spdMult,
      damage: def.baseDamage * dmgMult,
      radius: def.radius * (elite ? 1.5 : 1),
      color: def.color,
      xpReward: Math.max(1, Math.round(def.xpReward * rewardMult)),
      goldReward: Math.max(1, Math.round(def.goldReward * goldMult)),
      attackRange: def.attackRange,
      attackTimer: this.rng.range(0, def.attackInterval || 1),
      attackInterval: def.attackInterval,
      isBoss: !!def.isBoss,
      hitFlash: 0,
      slowTimer: 0,
      slowFactor: 0,
      spawnAnim: 0.3,
      contactCd: 0,
      elite: !!elite,
      specialTimer: this.rng.range(2, 4),
    };
    this.enemies.push(e);
    if (e.isBoss) {
      this.bossRef = e;
      this.sfx.play("boss");
      this.spawnText(e.x, e.y - e.radius - 12, "⚠ BOSS", "#f43f5e", 20);
      this.camShake = 6;
    }
  }

  // ==========================================================================
  // DIFFICULTY / WAVES / BOSSES
  // ==========================================================================
  private updateDifficulty(dt: number): void {
    this.timeSec += dt;
    this.threat += dt * CONFIG.difficulty.threatPerSec;
    this.waveTimer += dt;
    if (this.waveTimer >= CONFIG.waveDuration) {
      this.waveTimer -= CONFIG.waveDuration;
      this.wave += 1;
      this.threat += CONFIG.difficulty.threatPerWave;
      // Endless descent: announce the zone name when entering a new one,
      // otherwise the wave number. There is no final wave.
      const newZone = this.wave % CONFIG.zoneDepthEvery === 1;
      this.spawnText(
        this.player.x,
        this.player.y - 36,
        newZone ? this.zoneName() : "WAVE " + this.wave,
        "#fbbf24",
        newZone ? 22 : 20
      );
      if (this.wave % CONFIG.difficulty.bossEveryWave === 0 && !this.bossActive()) {
        // Every 10th wave spawns an "Ancient" boss — boosted stats for escalation.
        this.spawnBoss(this.wave % 10 === 0);
      }
    }
  }

  private bossActive(): boolean {
    return !!this.bossRef && this.bossRef.hp > 0;
  }

  private spawnBoss(ancient: boolean): void {
    const def = getEnemy(pickBossDefId(this.wave, this.rng));
    if (!def) return;
    const ang = this.rng.range(0, Math.PI * 2);
    const distFromPlayer = Math.max(this.viewW, this.viewH) / 2 + 60;
    const x = clamp(this.player.x + Math.cos(ang) * distFromPlayer, 40, CONFIG.arenaW - 40);
    const y = clamp(this.player.y + Math.sin(ang) * distFromPlayer, 40, CONFIG.arenaH - 40);
    this.spawnEnemy(
      def,
      x,
      y,
      false,
      ancient ? 1.8 : 1,
      ancient ? 1.3 : 1,
      ancient ? "Ancient " : ""
    );
    if (ancient) {
      this.spawnText(this.player.x, this.player.y - 60, "⚠ ANCIENT BOSS", "#f43f5e", 20);
      this.camShake = 8;
    }
  }

  // ==========================================================================
  // POOLS (object reuse to minimise GC on low-end devices)
  // ==========================================================================
  private acquireProjectile(): Projectile | null {
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) return this.projectiles[i];
    }
    if (this.projectiles.length < CONFIG.maxProjectiles) {
      const pr: Projectile = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        radius: 0,
        pierce: 0,
        life: 0,
        fromPlayer: false,
        color: "#fff",
        crit: false,
      };
      this.projectiles.push(pr);
      return pr;
    }
    return null;
  }

  private spawnProjectile(o: {
    x: number;
    y: number;
    angle: number;
    speed: number;
    damage: number;
    radius: number;
    pierce: number;
    fromPlayer: boolean;
    color: string;
    crit: boolean;
  }): void {
    const pr = this.acquireProjectile();
    if (!pr) return;
    pr.active = true;
    pr.x = o.x;
    pr.y = o.y;
    pr.vx = Math.cos(o.angle) * o.speed;
    pr.vy = Math.sin(o.angle) * o.speed;
    pr.damage = o.damage;
    pr.radius = Math.max(2, o.radius);
    pr.pierce = o.pierce;
    pr.life = 1.5;
    pr.fromPlayer = o.fromPlayer;
    pr.color = o.color;
    pr.crit = o.crit;
    pr.hit = o.pierce > 0 ? new Set<number>() : undefined;
  }

  private acquirePickup(): Pickup | null {
    for (let i = 0; i < this.pickups.length; i++) {
      if (!this.pickups[i].active) return this.pickups[i];
    }
    if (this.pickups.length < CONFIG.maxPickups) {
      const pk: Pickup = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        type: "xp",
        value: 0,
        radius: 4,
        magnet: false,
        bob: 0,
      };
      this.pickups.push(pk);
      return pk;
    }
    return null;
  }

  private spawnPickup(type: PickupType, x: number, y: number, value: number): void {
    const pk = this.acquirePickup();
    if (!pk) return;
    const a = this.rng.range(0, Math.PI * 2);
    const push = this.rng.range(6, 26);
    pk.active = true;
    pk.x = x;
    pk.y = y;
    pk.vx = Math.cos(a) * push;
    pk.vy = Math.sin(a) * push;
    pk.type = type;
    pk.value = value;
    pk.magnet = false;
    pk.bob = this.rng.range(0, Math.PI * 2);
    // brief outward scatter then settle (cheap: applied as initial offset)
    pk.x += pk.vx;
    pk.y += pk.vy;
  }

  private acquireText(): FloatingText | null {
    for (let i = 0; i < this.texts.length; i++) {
      if (!this.texts[i].active) return this.texts[i];
    }
    if (this.texts.length < CONFIG.maxTexts) {
      const t: FloatingText = {
        active: false,
        x: 0,
        y: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        text: "",
        color: "#fff",
        size: 13,
      };
      this.texts.push(t);
      return t;
    }
    return null;
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      s.r = s.maxR * Math.min(1, s.t / 0.4);
      if (s.t >= 0.5) this.shockwaves.splice(i, 1);
    }
  }

  private updateTexts(dt: number): void {
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) t.active = false;
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  private ensureSize(): void {
    const c = this.canvas;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    if (w === this.viewW && h === this.viewH) return;
    this.viewW = w;
    this.viewH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private camX(): number {
    const half = this.viewW / 2;
    return clamp(this.player.x - half, 0, Math.max(0, CONFIG.arenaW - this.viewW));
  }

  private camY(): number {
    const half = this.viewH / 2;
    return clamp(this.player.y - half, 0, Math.max(0, CONFIG.arenaH - this.viewH));
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, w, h);

    let shakeX = 0;
    let shakeY = 0;
    if (this.camShake > 0.15) {
      shakeX = this.rng.range(-1, 1) * this.camShake;
      shakeY = this.rng.range(-1, 1) * this.camShake;
      this.camShake *= 0.86;
    }
    const camX = this.camX() + shakeX;
    const camY = this.camY() + shakeY;

    this.drawGrid(ctx, camX, camY, w, h);

    ctx.strokeStyle = "rgba(125,211,252,0.22)";
    ctx.lineWidth = 4;
    ctx.strokeRect(-camX, -camY, CONFIG.arenaW, CONFIG.arenaH);

    for (const pk of this.pickups) if (pk.active) this.drawPickup(ctx, pk, camX, camY);

    for (const s of this.shockwaves) {
      ctx.strokeStyle = "rgba(245,158,11,0.55)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x - camX, s.y - camY, Math.max(1, s.r), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const pr of this.projectiles) {
      if (!pr.active) continue;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x - camX, pr.y - camY, pr.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      this.drawEnemy(ctx, e, camX, camY);
    }

    for (const fx of this.effects) {
      if (!fx.active) continue;
      this.drawActiveEffect(ctx, fx, camX, camY);
    }

    const p = this.player;
    if (p.frostAuraRadius > 0) {
      ctx.strokeStyle = "rgba(56,189,248,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.frostAuraRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const f of this.familiars) {
      ctx.fillStyle = "#a5f3fc";
      ctx.beginPath();
      ctx.arc(f.x - camX, f.y - camY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawPlayer(ctx, p, camX, camY);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const t of this.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(t.text, t.x - camX, t.y - camY);
      ctx.globalAlpha = 1;
    }

    this.drawMinimap(ctx);
  }

  // --------------------------------------------------------------------------
  // Minimap — screen-space overlay (top-right corner). Renders a tiny view of
  // the arena, player, enemies, bosses and chests. Cheap: just rect/arc draws
  // with per-entity lookups scaled from world->minimap coords.
  // --------------------------------------------------------------------------
  private drawMinimap(ctx: CanvasRenderingContext2D): void {
    const mm = CONFIG.minimap;
    const size = mm.size;
    const margin = mm.margin;
    const x0 = this.viewW - size - margin;
    const y0 = mm.topOffset;

    // Backing panel.
    ctx.save();
    ctx.fillStyle = "rgba(10,14,26,0.72)";
    ctx.strokeStyle = "rgba(125,211,252,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect?.(x0, y0, size, size, 6);
    if (!ctx.roundRect) {
      // Fallback for older WebViews lacking roundRect.
      ctx.rect(x0, y0, size, size);
    }
    ctx.fill();
    ctx.stroke();

    const sx = size / CONFIG.arenaW;
    const sy = size / CONFIG.arenaH;

    // Chest pickups (purple).
    ctx.fillStyle = "#c4b5fd";
    for (const pk of this.pickups) {
      if (!pk.active || pk.type !== "chest") continue;
      const mx = x0 + pk.x * sx;
      const my = y0 + pk.y * sy;
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    // Enemies (red dots, bosses larger).
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const mx = x0 + e.x * sx;
      const my = y0 + e.y * sy;
      if (e.isBoss) {
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(244,63,94,0.6)";
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.elite) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(mx - 1.2, my - 1.2, 2.4, 2.4);
      } else {
        ctx.fillStyle = e.color;
        ctx.fillRect(mx - 0.7, my - 0.7, 1.4, 1.4);
      }
    }

    // Player (cyan diamond, always on top).
    const p = this.player;
    const px = x0 + p.x * sx;
    const py = y0 + p.y * sy;
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.moveTo(px, py - 3);
    ctx.lineTo(px + 3, py);
    ctx.lineTo(px, py + 3);
    ctx.lineTo(px - 3, py);
    ctx.closePath();
    ctx.fill();

    // Viewport rectangle so player sees what's on screen.
    const camX = this.camX();
    const camY = this.camY();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x0 + camX * sx,
      y0 + camY * sy,
      this.viewW * sx,
      this.viewH * sy
    );
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Active-effect rendering. Each kind has its own cheap vector look.
  // NOTE: intentionally uses NO rng so the sim seed stays deterministic.
  // --------------------------------------------------------------------------
  private drawActiveEffect(
    ctx: CanvasRenderingContext2D,
    e: ActiveEffect,
    camX: number,
    camY: number
  ): void {
    const x = e.x - camX;
    const y = e.y - camY;
    const fade = clamp(e.life / Math.max(0.0001, e.maxLife), 0, 1);

    switch (e.kind) {
      case "blizzard": {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x, y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "rgba(186,230,253,0.7)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = e.angle + (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * e.radius, y + Math.sin(a) * e.radius);
          ctx.stroke();
        }
        break;
      }
      case "laser": {
        const len = e.radius;
        const ex = x + Math.cos(e.angle) * len;
        const ey = y + Math.sin(e.angle) * len;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = Math.max(2, e.width * 0.32);
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.lineCap = "butt";
        break;
      }
      case "tornado": {
        ctx.globalAlpha = 0.6 * fade;
        ctx.strokeStyle = "rgba(226,232,240,0.8)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = e.angle + (i * Math.PI) / 2;
          ctx.beginPath();
          for (let s = 0; s <= 1; s += 0.12) {
            const rr = s * e.radius;
            const ang = a + s * Math.PI * 2;
            const px = x + Math.cos(ang) * rr;
            const py = y + Math.sin(ang) * rr;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }
      case "blackhole": {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#0b1020";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(5, e.radius * 0.16), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const a = e.angle + (i * 2 * Math.PI) / 3;
          ctx.beginPath();
          ctx.arc(x, y, e.radius * (0.35 + 0.18 * i), a, a + Math.PI * 1.25);
          ctx.stroke();
        }
        break;
      }
      case "lightning": {
        ctx.globalAlpha = fade;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.5;
        for (let i = 0; i + 1 < e.points.length; i++) {
          this.drawJaggedLine(
            ctx,
            e.points[i].x - camX,
            e.points[i].y - camY,
            e.points[i + 1].x - camX,
            e.points[i + 1].y - camY,
            i
          );
        }
        break;
      }
      case "meteor": {
        if (e.warn > 0) {
          const grow = 1 - e.warn / 0.7;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = "rgba(245,158,11,0.12)";
          ctx.beginPath();
          ctx.arc(x, y, e.radius * grow, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(251,146,60,0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, e.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.55 * fade;
          ctx.fillStyle = "#fb923c";
          ctx.beginPath();
          ctx.arc(x, y, e.radius * fade, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Deterministic zig-zag line for lightning (no rng, keeps seed stable). */
  private drawJaggedLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const steps = 4;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const off = Math.sin((seed + 1) * 12.9898 + t * 28) * 8;
      ctx.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number): void {
    const step = 64;
    const startX = -((camX % step));
    const startY = -((camY % step));
    ctx.strokeStyle = "rgba(148,163,184,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, camY: number): void {
    const x = e.x - camX;
    const y = e.y - camY;
    if (x < -50 || y < -50 || x > this.viewW + 50 || y > this.viewH + 50) return;
    const scale = e.spawnAnim > 0 ? 0.5 + (1 - e.spawnAnim / 0.3) * 0.5 : 1;
    const r = Math.max(2, e.radius * scale);

    ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : e.color;
    ctx.beginPath();
    if (e.behavior === "ranged" && !e.isBoss) {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();

    if (e.isBoss) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.elite) {
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if ((e.isBoss || e.elite) && e.hp < e.maxHp) {
      const bw = r * 2;
      const bx = x - r;
      const by = y - r - 9;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = e.isBoss ? "#f43f5e" : "#fbbf24";
      ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerRuntime, camX: number, camY: number): void {
    const x = p.x - camX;
    const y = p.y - camY;
    const r = 13;
    if (p.dashActive > 0) {
      ctx.fillStyle = "rgba(125,211,252,0.3)";
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const flicker = p.invuln > 0 && Math.floor(performance.now() / 70) % 2 === 0;
    ctx.fillStyle = flicker ? "#ffffff" : CONFIG.colors.player;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CONFIG.colors.playerCore;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CONFIG.colors.player;
    ctx.beginPath();
    ctx.arc(x + p.facingX * r * 0.9, y + p.facingY * r * 0.9, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, pk: Pickup, camX: number, camY: number): void {
    const x = pk.x - camX;
    const y = pk.y - camY;
    if (x < -20 || y < -20 || x > this.viewW + 20 || y > this.viewH + 20) return;
    let color: string = CONFIG.colors.xpGem;
    let rad = 4;
    if (pk.type === "gold") {
      color = CONFIG.colors.gold;
    } else if (pk.type === "heal") {
      color = CONFIG.colors.heal;
      rad = 6;
    } else if (pk.type === "chest") {
      color = CONFIG.colors.chest;
      rad = 9;
    }
    const bob = Math.sin(pk.bob * 4) * 1.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + bob, rad, 0, Math.PI * 2);
    ctx.fill();
    if (pk.type === "chest") {
      ctx.fillStyle = "#1e1b4b";
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", x, y + bob + 1);
    }
  }

  // ==========================================================================
  // SNAPSHOT + PERSISTENCE
  // ==========================================================================
  getSnapshot(): UISnapshot {
    const p = this.player;
    let liveEnemies = 0;
    for (const e of this.enemies) if (e.hp > 0) liveEnemies++;

    const dashCdPct = p.hasDash
      ? clamp(p.dashTimer / Math.max(0.0001, p.dashCooldown), 0, 1)
      : 0;

    const boss =
      this.bossRef && this.bossRef.hp > 0
        ? {
            active: true,
            name: this.bossRef.name,
            hp: Math.max(0, this.bossRef.hp),
            maxHp: this.bossRef.maxHp,
          }
        : null;

    const ownedSkills = Object.keys(p.skills).map((id) => {
      const def = getSkill(id);
      return {
        id,
        level: p.skills[id] ?? 0,
        icon: def?.icon ?? "❓",
        name: def?.name ?? "Unknown",
      };
    });

    return {
      phase: this.phase,
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      level: p.level,
      xp: Math.floor(p.xp),
      xpToNext: p.xpToNext,
      wave: this.wave,
      threatPct: Math.round(this.threat * 100),
      timeSec: this.timeSec,
      gold: Math.floor(p.gold),
      kills: p.kills,
      enemyCount: liveEnemies,
      hasDash: p.hasDash,
      dashCdPct,
      offers: this.offers.slice(),
      pendingLevels: this.pendingLevels,
      boss,
      ownedSkills,
      ownedActiveSkills: Object.keys(p.activeSkills).map((id) => {
        const def = getActiveSkill(id);
        const lvl = p.activeSkills[id] ?? 0;
        const cd = def ? def.cooldown(lvl) : 1;
        const t = this.activeTimers[id] ?? 0;
        return {
          id,
          name: def?.name ?? "Unknown",
          icon: def?.icon ?? "❓",
          level: lvl,
          mythic: !!def?.mythic,
          cdPct: cd > 0 ? clamp(t / cd, 0, 1) : 0,
        };
      }),
      ownedEquipment: p.ownedEquipment.slice(),
      equipped: (Object.keys(p.equipped) as EquipSlot[]).map((slot) => {
        const id = p.equipped[slot]!;
        const def = getEquipment(id);
        return {
          slot,
          id,
          name: def?.name ?? "Unknown",
          icon: def?.icon ?? "❓",
        };
      }),
      zone: this.zoneName(),
      fps: Math.round(this.fps),
    };
  }

  private emitUI(): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      try {
        fn(snap);
      } catch (err) {
        console.warn("[Engine] UI listener error:", err);
      }
    }
  }

  private xpForLevel(level: number): number {
    return Math.round(CONFIG.xpBase * Math.pow(level, CONFIG.xpGrowth)) + CONFIG.xpBase;
  }

  private createPlayer(): PlayerRuntime {
    const b = CONFIG.player;
    return {
      x: CONFIG.arenaW / 2,
      y: CONFIG.arenaH / 2,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      hp: b.maxHp,
      maxHp: b.maxHp,
      hpRegen: b.hpRegen,
      armor: b.armor,
      lifesteal: b.lifesteal,
      thorns: b.thorns,
      invuln: 0,
      level: 1,
      xp: 0,
      xpToNext: this.xpForLevel(1),
      damage: b.damage,
      attackSpeed: b.attackSpeed,
      attackTimer: 0,
      projectileSpeed: b.projectileSpeed,
      projectileCount: b.projectileCount,
      projectilePierce: b.projectilePierce,
      projectileRadius: b.projectileRadius,
      areaMult: b.areaMult,
      critChance: b.critChance,
      critMult: b.critMult,
      moveSpeed: b.moveSpeed,
      pickupRadius: b.pickupRadius,
      bonusXp: b.bonusXp,
      bonusGold: b.bonusGold,
      hasDash: b.hasDash,
      dashCooldown: b.dashCooldown,
      dashTimer: 0,
      dashDuration: b.dashDuration,
      dashActive: 0,
      familiarCount: b.familiarCount,
      familiarDamage: b.familiarDamage,
      frostAuraRadius: 0,
      frostAuraSlow: 0,
      gold: 0,
      kills: 0,
      skills: {},
      activeSkills: {},
      ownedEquipment: [],
      equipped: {},
    };
  }

  serializePlayer(): PlayerRuntime {
    try {
      return JSON.parse(JSON.stringify(this.player));
    } catch {
      return this.player;
    }
  }

  saveRunNow(): void {
    if (this.phase !== "playing" && this.phase !== "paused" && this.phase !== "levelup") return;
    try {
      const snap: RunSnapshot = {
        version: SAVE_VERSION,
        seed: this.seed,
        player: this.serializePlayer(),
        wave: this.wave,
        timeSec: this.timeSec,
        threat: this.threat,
        kills: this.player.kills,
        gold: this.player.gold,
      };
      saveRun(snap);
    } catch (err) {
      console.warn("[Engine] saveRun failed:", err);
    }
  }

  saveRunDebounced(): void {
    const now = performance.now();
    if (now - this.lastSave < 400) return;
    this.lastSave = now;
    this.saveRunNow();
  }

  private saveMetaAfterRun(): void {
    try {
      const m = loadMeta();
      m.runs += 1;
      m.totalKills += this.player.kills;
      m.totalGold += this.player.gold;
      if (this.wave > m.bestWave) m.bestWave = this.wave;
      if (this.timeSec > m.bestTime) m.bestTime = this.timeSec;
      if (this.player.kills > m.bestKills) m.bestKills = this.player.kills;
      saveMeta(m);
    } catch (err) {
      console.warn("[Engine] saveMeta failed:", err);
    }
  }
}
