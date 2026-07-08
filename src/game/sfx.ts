// ============================================================================
// SOUND MANAGER. Tiny WebAudio synth — no asset files, no network, fully
// offline. Everything is lazy + guarded: if AudioContext is unavailable or the
// user hasn't interacted yet, every call silently no-ops. It can never throw.
// ============================================================================
export type SfxName =
  | "shoot"
  | "hit"
  | "levelup"
  | "hurt"
  | "boss"
  | "pickup"
  | "death"
  | "dash";

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): void {
    if (this.ctx) return;
    try {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  /** Call on the first user gesture so mobile browsers allow audio. */
  resume(): void {
    this.ensure();
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  play(name: SfxName): void {
    if (this.muted) return;
    this.ensure();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);

      let freq = 440;
      let dur = 0.08;
      let type: OscillatorType = "square";
      let vol = 0.4;

      switch (name) {
        case "shoot":
          freq = 680;
          dur = 0.05;
          type = "square";
          vol = 0.12;
          break;
        case "hit":
          freq = 240;
          dur = 0.05;
          type = "triangle";
          vol = 0.18;
          break;
        case "pickup":
          freq = 900;
          dur = 0.06;
          type = "sine";
          vol = 0.22;
          break;
        case "hurt":
          freq = 150;
          dur = 0.2;
          type = "sawtooth";
          vol = 0.35;
          break;
        case "levelup":
          freq = 520;
          dur = 0.28;
          type = "triangle";
          vol = 0.4;
          break;
        case "boss":
          freq = 90;
          dur = 0.6;
          type = "sawtooth";
          vol = 0.5;
          break;
        case "death":
          freq = 220;
          dur = 0.5;
          type = "sawtooth";
          vol = 0.4;
          break;
        case "dash":
          freq = 720;
          dur = 0.1;
          type = "sine";
          vol = 0.25;
          break;
      }

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (name === "levelup") osc.frequency.linearRampToValueAtTime(freq * 1.8, t + dur);
      if (name === "death") osc.frequency.exponentialRampToValueAtTime(60, t + dur);
      if (name === "boss") osc.frequency.exponentialRampToValueAtTime(40, t + dur);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch {
      /* never let audio break gameplay */
    }
  }
}
