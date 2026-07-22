import { Circle, Line } from "react-konva";
import { Module } from "./Module";

const WIDTH = 100;
const HEIGHT = 96;
const BULB_CX = WIDTH / 2;
const BULB_CY = 52;

type LampProps<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  title?: string;
  /** True when the lamp has both hot and return continuity (energized). */
  lit: boolean;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
};

/**
 * Lamp load with hot (bottom:0) and neutral (bottom:1) terminals.
 * Glow / bulb / filament respond to the `lit` prop.
 */
export function Lamp<Id extends string>({
  id,
  x,
  y,
  title = "Lamp",
  lit,
  onDragMove,
  onDragEnd,
}: LampProps<Id>) {
  const fill = lit ? "#fefce8" : "#f0f9ff";
  const stroke = lit ? "#ca8a04" : "#7dd3fc";

  return (
    <Module
      id={id}
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      fill={fill}
      stroke={stroke}
      bodyPointer={false}
      terminals={{ bottom: ["+", "COM"] }}
      onDragMove={
        onDragMove
          ? (moduleId, mx, my) => onDragMove(moduleId as Id, mx, my)
          : undefined
      }
      onDragEnd={
        onDragEnd
          ? (moduleId, mx, my) => onDragEnd(moduleId as Id, mx, my)
          : undefined
      }
    >
      <Circle
        x={BULB_CX}
        y={BULB_CY}
        radius={22}
        fill="rgba(250, 204, 21, 0.35)"
        visible={lit}
        listening={false}
      />
      <Circle
        x={BULB_CX}
        y={BULB_CY}
        radius={16}
        fill={lit ? "#fef08a" : "#f4f4f5"}
        stroke={lit ? "#ca8a04" : "#a1a1aa"}
        strokeWidth={2}
        listening={false}
      />
      <Line
        points={[
          BULB_CX - 6,
          BULB_CY + 2,
          BULB_CX,
          BULB_CY - 6,
          BULB_CX + 6,
          BULB_CY + 2,
        ]}
        stroke={lit ? "#a16207" : "#d4d4d8"}
        strokeWidth={1.5}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Module>
  );
}

export const LAMP_SIZE = { width: WIDTH, height: HEIGHT } as const;

/** Terminal indices on the lamp’s bottom edge. */
export const LAMP_TERMINALS = {
  hot: 0,
  neutral: 1,
} as const;
