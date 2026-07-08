// ============================================================================
// GAME SCREEN — mounts the canvas, owns the Engine lifecycle, and layers the
// React UI (HUD, joystick, modals, shop) on top. The engine is created once on
// mount; it begins the run (new or resumed) and the rAF loop. Everything is
// torn down cleanly on unmount.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Engine } from "../game/Engine";
import type { UISnapshot } from "../game/types";
import { loadRun } from "../game/save";
import { HUD, DashButton } from "./HUD";
import { VirtualJoystick } from "./VirtualJoystick";
import { LevelUpModal } from "./LevelUpModal";
import { PauseModal } from "./PauseModal";
import { ShopModal } from "./ShopModal";
import { GameOverModal } from "./GameOverModal";

export function GameScreen({
  mode,
  sound,
  onToggleSound,
  onExit,
}: {
  mode: "new" | "continue";
  sound: boolean;
  onToggleSound: (v: boolean) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<UISnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  // Create engine once and begin the run. mode/sound are captured at mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let created: Engine | undefined;
    try {
      created = new Engine(canvas, { sound });
    } catch (err) {
      console.error("[GameScreen] engine init failed:", err);
    }
    if (!created) return;
    const eng = created;
    engineRef.current = eng;
    eng.setMuted(!sound);

    const unsub = eng.subscribe(setSnap);

    if (mode === "continue") {
      const saved = loadRun();
      if (saved) eng.loadRun(saved);
      else eng.start();
    } else {
      eng.start();
    }
    eng.beginLoop();
    setReady(true);

    // Resume WebAudio on the first user gesture (mobile autoplay policy).
    const resumeAudio = () => {
      try {
        eng.sfx.resume();
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointerdown", resumeAudio);
    };
    window.addEventListener("pointerdown", resumeAudio);

    return () => {
      window.removeEventListener("pointerdown", resumeAudio);
      unsub();
      eng.destroy();
      engineRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect live sound setting.
  useEffect(() => {
    engineRef.current?.setMuted(!sound);
  }, [sound]);

  const engine = engineRef.current;

  const openShop = () => {
    // The shop only ever opens from a paused state — safe & deterministic.
    engineRef.current?.pause();
    setShopOpen(true);
  };

  return (
    <div
      className="relative h-[100dvh] w-screen select-none overflow-hidden bg-[#0a0e1a]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {ready && engine && snap && (
        <>
          <HUD snap={snap} engine={engine} onOpenShop={openShop} />
          <VirtualJoystick engine={engine} />
          <DashButton engine={engine} snap={snap} />

          {snap.phase === "levelup" && <LevelUpModal engine={engine} snap={snap} />}

          {snap.phase === "paused" && !shopOpen && (
            <PauseModal
              engine={engine}
              sound={sound}
              onToggleSound={onToggleSound}
              onExit={onExit}
              onOpenShop={openShop}
              gold={snap.gold}
            />
          )}

          {snap.phase === "paused" && shopOpen && (
            <ShopModal snap={snap} engine={engine} onClose={() => setShopOpen(false)} />
          )}

          {snap.phase === "gameover" && (
            <GameOverModal engine={engine} snap={snap} onExit={onExit} />
          )}
        </>
      )}
    </div>
  );
}
