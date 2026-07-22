import { Circle } from "react-konva";
import { Module } from "./comps/Module";

const WIDTH = 160;
const HEIGHT = 120;
const TERMINAL_RADIUS = 7;

type DoorbellButtonProps<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  title: string;
  pressed: boolean;
  onPressedChange: (id: Id, pressed: boolean) => void;
};

/**
 * Declarative doorbell button — press target and terminals inside a Module shell.
 * Mirrors the imperative Konva button shape with React state instead of
 * mutating node attributes by hand.
 */
export function DoorbellButton<Id extends string>({
  id,
  x,
  y,
  title,
  pressed,
  onPressedChange,
}: DoorbellButtonProps<Id>) {
  const fill = pressed ? "#bae6fd" : "#f0f9ff";
  const stroke = pressed ? "#0284c7" : "#7dd3fc";
  const padFill = pressed ? "#0369a1" : "#38bdf8";

  return (
    <Module
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      fill={fill}
      stroke={stroke}
    >
      <Circle
        x={WIDTH / 2}
        y={HEIGHT / 2 + 8}
        radius={22}
        fill={padFill}
        stroke="#0c4a6e"
        strokeWidth={2}
        onMouseDown={() => onPressedChange(id, true)}
        onMouseUp={() => onPressedChange(id, false)}
        onMouseLeave={() => onPressedChange(id, false)}
        onTouchStart={() => onPressedChange(id, true)}
        onTouchEnd={() => onPressedChange(id, false)}
      />
      <Circle
        x={0}
        y={HEIGHT / 2}
        radius={TERMINAL_RADIUS}
        fill="#f8fafc"
        stroke="#475569"
        strokeWidth={2}
        name="terminal"
      />
      <Circle
        x={WIDTH}
        y={HEIGHT / 2}
        radius={TERMINAL_RADIUS}
        fill="#f8fafc"
        stroke="#475569"
        strokeWidth={2}
        name="terminal"
      />
    </Module>
  );
}
