import { useMemo, useState } from "react";
import { Layer, Stage } from "react-konva";
import { DoorbellButton } from "./DoorbellButton";
import { Switch } from "./comps/Switch";
import { Module } from "./comps/Module";

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 560;

type ButtonId = "front" | "rear";

type PressedState = Record<ButtonId, boolean>;

/**
 * Experimental React + Konva lab shell.
 * Keeps canvas pieces as declarative components driven by React state.
 */
export function App() {
  const [pressed, setPressed] = useState<PressedState>({
    front: false,
    rear: false,
  });

  const status = useMemo(() => {
    const active = Object.entries(pressed)
      .filter(([, isDown]) => isDown)
      .map(([id]) => id);
    if (active.length === 0) return "Idle — click a button";
    return `Pressed: ${active.join(", ")}`;
  }, [pressed]);

  /**
   * Updates one button's pressed flag.
   */
  function setButtonPressed(id: ButtonId, isDown: boolean) {
    setPressed((prev) => ({ ...prev, [id]: isDown }));
  }

  /**
   * Clears all button pressed state.
   */
  function reset() {
    setPressed({ front: false, rear: false });
  }

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Andy · React + Konva</h1>
        <p>{status}</p>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </header>
      <div className="stage-wrap">
        <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
          <Layer>
            <DoorbellButton
              id="front"
              x={120}
              y={160}
              title="Front"
              pressed={pressed.front}
              onPressedChange={setButtonPressed}
            />
            <DoorbellButton
              id="rear"
              x={420}
              y={160}
              title="Rear"
              pressed={pressed.rear}
              onPressedChange={setButtonPressed}
            />
            <Switch />
            <Module width={100} height={100} title="Switch">
            </Module>
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
