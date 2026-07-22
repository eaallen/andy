import { Circle, Text } from "react-konva";
import { Module } from "./Module";

const WIDTH = 100;
const HEIGHT = 84;
const PAD_RADIUS = 16;
const BEZEL_RADIUS = 20;
const PAD_CENTER_Y = 46;

type DoorbellButtonProps<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  title: string;
  pressed: boolean;
  onPressedChange: (id: Id, pressed: boolean) => void;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
};

/**
 * Declarative doorbell button — raised press pad inside a Module shell.
 * Connection nodes come from Module (wiring UI via AppCtx).
 */
export function DoorbellButton<Id extends string>({
  id,
  x,
  y,
  title,
  pressed,
  onPressedChange,
  onDragMove,
  onDragEnd,
}: DoorbellButtonProps<Id>) {
  const fill = pressed ? "#dbeafe" : "#f0f9ff";
  const stroke = pressed ? "#2563eb" : "#7dd3fc";
  const padY = pressed ? PAD_CENTER_Y + 2 : PAD_CENTER_Y;
  const padFill = pressed ? "#1d4ed8" : "#3b82f6";
  const padStroke = pressed ? "#1e3a8a" : "#1d4ed8";

  /**
   * Marks the doorbell as pressed.
   */
  function press() {
    onPressedChange(id, true);
  }

  /**
   * Clears the pressed state.
   */
  function release() {
    onPressedChange(id, false);
  }

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
      terminals={{ top: 3 }}
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
      {/* Metal-ish bezel around the button */}
      <Circle
        x={WIDTH / 2}
        y={PAD_CENTER_Y}
        radius={BEZEL_RADIUS}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth={1.5}
        listening={false}
      />
      <Circle
        x={WIDTH / 2}
        y={PAD_CENTER_Y}
        radius={BEZEL_RADIUS - 3}
        fill="#e2e8f0"
        listening={false}
      />
      {/* Raised press pad */}
      <Circle
        x={WIDTH / 2}
        y={padY}
        radius={PAD_RADIUS}
        fill={padFill}
        stroke={padStroke}
        strokeWidth={2}
        shadowColor="rgba(29, 78, 216, 0.55)"
        shadowBlur={pressed ? 2 : 8}
        shadowOffsetY={pressed ? 1 : 3}
        shadowForStrokeEnabled={false}
        hitStrokeWidth={8}
        onMouseDown={press}
        onMouseUp={release}
        onMouseLeave={release}
        onTouchStart={press}
        onTouchEnd={release}
      />
      {/* Gloss highlight ring */}
      <Circle
        x={WIDTH / 2}
        y={padY - 1}
        radius={PAD_RADIUS * 0.45}
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1.5}
        listening={false}
      />
      <Text
        x={0}
        y={PAD_CENTER_Y + PAD_RADIUS + 8}
        width={WIDTH}
        align="center"
        text="Press"
        fontSize={10}
        fontFamily="system-ui, Arial, sans-serif"
        fontStyle="bold"
        fill="#2563eb"
        listening={false}
      />
    </Module>
  );
}

export const DOORBELL_SIZE = { width: WIDTH, height: HEIGHT } as const;
