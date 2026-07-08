// Main menu / title screen with stats, run controls and a quick how-to.
import type { ReactNode } from "react";
import type { MetaSave } from "../game/save";
import { formatTime } from "../game/utils";
import { Btn } from "./ui";

export function StartScreen({
  meta,
  sound,
  onToggleSound,
  onNew,
  onContinue,
  canContinue,
}: {
  meta: MetaSave;
  sound: boolean;
  onToggleSound: (v: boolean) => void;
  onNew: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] px-6 py-10 text-center">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-violet-700/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-2 text-5xl">⚔️🧙‍♂️🐉</div>
        <h1 className="bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          EMBERDEPTHS
        </h1>
        <p className="mt-1 text-sm text-white/50">A roguelike survival RPG · endless descent</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label="Best Wave" value={meta.bestWave} />
          <MiniStat label="Best Time" value={formatTime(meta.bestTime)} />
          <MiniStat label="Best Kills" value={meta.bestKills} />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {canContinue && (
            <Btn primary onClick={onContinue}>
              ▶ Continue Run
            </Btn>
          )}
          <Btn onClick={onNew} primary={!canContinue}>
            ✦ New Run
          </Btn>
          <button
            onClick={() => onToggleSound(!sound)}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-white/80 ring-1 ring-white/10 active:scale-95"
          >
            🔊 Sound: {sound ? "ON" : "OFF"}
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-[11px] leading-relaxed text-white/60">
          <p className="mb-1 font-bold text-white/80">How to play</p>
          <p>• Drag the <span className="text-cyan-300">left side</span> of the screen to move.</p>
          <p>• Auto-attack the nearest foe. Grab 💎 gems & 🟣 treasure to level up.</p>
          <p>• Level up → pick from <span className="text-fuchsia-300">passive, active & fusion</span> skills.</p>
          <p>• Invest in a branch to unlock <span className="text-pink-300">⚡ Fusion capstones</span>.</p>
          <p>• Spend 💰 gold in the 🛒 Vault on Mythic skills & 🛡️ equipment.</p>
          <p>• Endless descent — bosses & zones escalate forever.</p>
        </div>
        <p className="mt-4 text-[10px] text-white/30">Built for Android · 100% offline · v1.0</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-2 ring-1 ring-white/10">
      <div className="text-[9px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}
