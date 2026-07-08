// Pause overlay: resume / restart / toggle sound / quit to menu.
import type { Engine } from "../game/Engine";
import { Btn } from "./ui";

export function PauseModal({
  engine,
  sound,
  onToggleSound,
  onExit,
  onOpenShop,
  gold,
}: {
  engine: Engine;
  sound: boolean;
  onToggleSound: (v: boolean) => void;
  onExit: () => void;
  onOpenShop: () => void;
  gold: number;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900/90 p-5 text-center">
        <div className="mb-4 text-xl font-black tracking-wide text-white">PAUSED</div>
        <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-bold tabular-nums text-amber-200 ring-1 ring-amber-400/20">
          💰 {gold} gold
        </div>
        <div className="flex flex-col gap-2">
          <Btn primary onClick={() => engine.resume()}>
            ▶ Resume
          </Btn>
          <Btn onClick={onOpenShop}>🛒 Mythic Shop</Btn>
          <Btn onClick={() => engine.start()}>↻ Restart Run</Btn>
          <button
            onClick={() => onToggleSound(!sound)}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-white/80 ring-1 ring-white/10 active:scale-95"
          >
            🔊 Sound: {sound ? "ON" : "OFF"}
          </button>
          <Btn danger onClick={onExit}>
            ⏏ Quit to Menu
          </Btn>
        </div>
      </div>
    </div>
  );
}
