import type { ReactNode } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Rect, Text } from "react-konva";
import {
  DEFAULT_TERMINALS,
  TERMINAL_RADIUS,
  listTerminals,
  terminalKey,
  type TerminalCounts,
} from "./terminals";

type ModuleProps = {
  id: string;
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
  /** Terminal currently selected as the first endpoint of a new wire. */
  pendingTerminalId?: string | null;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onTerminalPointerDown?: (
    terminalId: string,
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  children?: ReactNode;
};

/**
 * Shared Konva shell for circuit modules (switches, transformers, buttons, etc.).
 * Renders the positioned group, tinted box, title, and edge connection nodes;
 * children fill the interior.
 */
export function Module({
  id,
  x = 0,
  y = 0,
  width,
  height,
  title,
  fill = "#f0f9ff",
  stroke = "#7dd3fc",
  draggable = true,
  terminals = DEFAULT_TERMINALS,
  pendingTerminalId = null,
  onDragMove,
  onDragEnd,
  onTerminalPointerDown,
  children,
}: ModuleProps) {
  const sides = listTerminals(terminals, width, height);

  return (
    <Group
      x={x}
      y={y}
      draggable={draggable}
      onDragMove={(e) => {
        onDragMove?.(id, e.target.x(), e.target.y());
      }}
      onDragEnd={(e) => {
        onDragEnd?.(id, e.target.x(), e.target.y());
      }}
    >
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
      {sides.map(({ side, index, x: tx, y: ty }) => {
        const tid = terminalKey(id, side, index);
        const isPending = pendingTerminalId === tid;
        return (
          <Circle
            key={tid}
            x={tx}
            y={ty}
            radius={TERMINAL_RADIUS}
            fill="#f8fafc"
            stroke={isPending ? "#2563eb" : "#475569"}
            strokeWidth={isPending ? 3 : 2}
            hitStrokeWidth={12}
            name={`terminal-${tid}`}
            id={tid}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onTerminalPointerDown?.(tid, e);
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              onTerminalPointerDown?.(tid, e);
            }}
          />
        );
      })}
    </Group>
  );
}
