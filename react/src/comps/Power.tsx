import { Circle, Line, Text } from "react-konva";
import { Module } from "./Module";

const WIDTH = 110;
const HEIGHT = 88;
const SYMBOL_CX = WIDTH / 2;
const SYMBOL_CY = 42;
const SYMBOL_R = 16;

type PowerKind = "ac" | "dc";

type PowerProps<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  title?: string;
  /** Schematic icon: AC sine (default) or DC +/−. */
  kind?: PowerKind;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
  voltage?: number;
};

/** Builds polyline points for one sine cycle centered at (cx, cy). */
function sineWavePoints(
  cx: number,
  cy: number,
  halfW: number,
  amp: number,
  samples: number,
): number[] {
  const points: number[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    points.push(cx - halfW + t * halfW * 2, cy + Math.sin(t * Math.PI * 2) * amp);
  }
  return points;
}

/**
 * Single-leg power source: L1 (top:0), N (top:1), G (top:2).
 */
export function Power<Id extends string>({
  id,
  x,
  y,
  title = "Power",
  kind = "ac",
  onDragMove,
  onDragEnd,
  voltage = 120,
}: PowerProps<Id>) {
  const stroke = "#18181b";
  const markSize = SYMBOL_R * 0.28;
  const markY = SYMBOL_R * 0.38;

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
      <Circle
        x={SYMBOL_CX}
        y={SYMBOL_CY}
        radius={SYMBOL_R}
        stroke={stroke}
        strokeWidth={2}
        fill="transparent"
        listening={false}
      />
      {kind === "dc" ? (
        <>
          <Line
            points={[
              SYMBOL_CX - markSize,
              SYMBOL_CY - markY,
              SYMBOL_CX + markSize,
              SYMBOL_CY - markY,
            ]}
            stroke={stroke}
            strokeWidth={2}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[
              SYMBOL_CX,
              SYMBOL_CY - markY - markSize,
              SYMBOL_CX,
              SYMBOL_CY - markY + markSize,
            ]}
            stroke={stroke}
            strokeWidth={2}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[
              SYMBOL_CX - markSize,
              SYMBOL_CY + markY,
              SYMBOL_CX + markSize,
              SYMBOL_CY + markY,
            ]}
            stroke={stroke}
            strokeWidth={2}
            lineCap="round"
            listening={false}
          />
        </>
      ) : (
        <Line
          points={sineWavePoints(
            SYMBOL_CX,
            SYMBOL_CY,
            SYMBOL_R * 0.55,
            SYMBOL_R * 0.28,
            24,
          )}
          stroke={stroke}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
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
