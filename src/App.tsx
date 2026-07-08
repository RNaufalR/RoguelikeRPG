// Top-level router: menu <-> game. Owns meta/sound state and per-run remount key.
import { useState } from "react";
import { StartScreen } from "./components/StartScreen";
import { GameScreen } from "./components/GameScreen";
import { hasRun, loadMeta, saveMeta, type MetaSave } from "./game/save";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [mode, setMode] = useState<"new" | "continue">("new");
  const [runKey, setRunKey] = useState(0);
  const [meta, setMeta] = useState<MetaSave>(() => loadMeta());
  const [sound, setSound] = useState<boolean>(() => meta.settings.sound);

  const startNew = () => {
    setMode("new");
    setRunKey((k) => k + 1);
    setScreen("game");
  };

  const continueRun = () => {
    setMode("continue");
    setRunKey((k) => k + 1);
    setScreen("game");
  };

  const exitToMenu = () => {
    setMeta(loadMeta());
    setScreen("menu");
  };

  const toggleSound = (v: boolean) => {
    setSound(v);
    const m = loadMeta();
    m.settings.sound = v;
    saveMeta(m);
    setMeta(m);
  };

  if (screen === "menu") {
    return (
      <StartScreen
        meta={meta}
        sound={sound}
        onToggleSound={toggleSound}
        onNew={startNew}
        onContinue={continueRun}
        canContinue={hasRun()}
      />
    );
  }

  return (
    <GameScreen
      key={runKey}
      mode={mode}
      sound={sound}
      onToggleSound={toggleSound}
      onExit={exitToMenu}
    />
  );
}
