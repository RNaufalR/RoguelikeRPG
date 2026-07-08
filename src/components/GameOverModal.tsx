// Game over screen with run summary + retry / menu.
import type { Engine } from "../game/Engine";
import type { UISnapshot } from "../game/types";
import { formatTime } from "../game/utils";
import { Btn, StatRow } from "./ui";

export function GameOverModal({
  engine,
  snap,
  onExit,
}: {
  engine: Engine;
  snap: UISnapshot;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-rose-500/30 bg-slate-900/95 p-5 text-center">
        <div className="text-4xl">💀</div>
        <div className="mt-1 text-2xl font-black tracking-wide text-rose-300">YOU DIED</div>
        <div className="mt-4 flex flex-col gap-1.5 text-left">
          <StatRow label="Wave Reached" value={snap.wave} />
          <StatRow label="Survived" value={formatTime(snap.timeSec)} />
          <StatRow label="Kills" value={snap.kills} />
          <StatRow label="Gold" value={snap.gold} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Btn primary onClick={() => engine.start()}>
            ↻ Try Again
          </Btn>
          <Btn onClick={onExit}>⏏ Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}
