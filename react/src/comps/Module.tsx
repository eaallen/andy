import type { ReactNode } from "react";
import { Circle, Group, Rect, Text } from "react-konva";

/** Distance from shell edge to terminal center so wire stubs stay visible. */
const TERMINAL_OUTSET = 20;
const TERMINAL_RADIUS = 7;

type TerminalSide = "top" | "right" | "bottom" | "left";

type TerminalCounts = Partial<Record<TerminalSide, number>>;

type ModuleProps = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  title: string;
  fill?: string;
  stroke?: string;
  draggable?: boolean;
  /**
   * How many connection nodes to place on each edge.
   * Omitted sides get none; defaults to one on every side.
   */
  terminals?: TerminalCounts;
  children?: ReactNode;
};

const DEFAULT_TERMINALS: TerminalCounts = {
  top: 1,
  right: 1,
  bottom: 1,
  left: 1,
};

/**
 * Evenly spaced positions along an edge length (centers between the ends).
 * @param {number} count - Number of terminals on this side.
 * @param {number} length - Edge length in local pixels.
 */
function spacedAlong(count: number, length: number) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * length);
}

/**
 * Local centers for terminals sitting just outside one shell edge.
 * @param {TerminalSide} side - Edge the nodes attach to.
 * @param {number} count - How many nodes on this edge.
 * @param {number} width - Module shell width.
 * @param {number} height - Module shell height.
 */
function terminalPositions(
  side: TerminalSide,
  count: number,
  width: number,
  height: number,
) {
  switch (side) {
    case "top":
      return spacedAlong(count, width).map((x) => ({
        x,
        y: -TERMINAL_OUTSET,
      }));
    case "bottom":
      return spacedAlong(count, width).map((x) => ({
        x,
        y: height + TERMINAL_OUTSET,
      }));
    case "left":
      return spacedAlong(count, height).map((y) => ({
        x: -TERMINAL_OUTSET,
        y,
      }));
    case "right":
      return spacedAlong(count, height).map((y) => ({
        x: width + TERMINAL_OUTSET,
        y,
      }));
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

/**
 * Shared Konva shell for circuit modules (switches, transformers, buttons, etc.).
 * Renders the positioned group, tinted box, title, and edge connection nodes;
 * children fill the interior.
 */
export function Module({
  x = 0,
  y = 0,
  width,
  height,
  title,
  fill = "#f0f9ff",
  stroke = "#7dd3fc",
  draggable = true,
  terminals = DEFAULT_TERMINALS,
  children,
}: ModuleProps) {
  const sides = (Object.keys(terminals) as TerminalSide[]).flatMap((side) => {
    const count = terminals[side] ?? 0;
    return terminalPositions(side, count, width, height).map((pos, index) => ({
      side,
      index,
      ...pos,
    }));
  });

  return (
    <Group x={x} y={y} draggable={draggable}>
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        cornerRadius={8}
      />
      <Text
        x={10}
        y={8}
        text={title}
        fontSize={13}
        fontFamily="system-ui, Arial, sans-serif"
        fontStyle="bold"
        fill="#1e40af"
        listening={false}
      />
      {children}
      {sides.map(({ side, index, x: tx, y: ty }) => (
        <Circle
          key={`${side}-${index}`}
          x={tx}
          y={ty}
          radius={TERMINAL_RADIUS}
          fill="#f8fafc"
          stroke="#475569"
          strokeWidth={2}
          name={`terminal-${side}-${index}`}
        />
      ))}
    </Group>
  );
}
