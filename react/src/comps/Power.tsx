import { Text } from "react-konva";
import { Module } from "./Module";

const WIDTH = 110;
const HEIGHT = 88;

type PowerProps<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  title?: string;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
  voltage?: number;
};

/**
 * Single-leg power source: L1 (top:0), N (top:1), G (top:2).
 */
export function Power<Id extends string>({
  id,
  x,
  y,
  title = "Power",
  onDragMove,
  onDragEnd,
  voltage = 120,
}: PowerProps<Id>) {
  return (
    <Module
      id={id}
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      bodyPointer={false}
      terminals={{ top: ["L1", "N", "G"] }}
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
      <Text
        x={12}
        y={62}
        text={`${voltage}V`}
        fontSize={11}
        fontFamily="system-ui, Arial, sans-serif"
        fill="#71717a"
        listening={false}
      />
    </Module>
  );
}

export const POWER_SIZE = { width: WIDTH, height: HEIGHT } as const;

/** Terminal indices on the power source’s top edge. */
export const POWER_TERMINALS = {
  hot: 0,
  neutral: 1,
  ground: 2,
} as const;
