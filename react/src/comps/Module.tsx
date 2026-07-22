import type { ReactNode } from "react";
import { Circle, Group, Rect, Text } from "react-konva";
import { useAppCtx } from "../appCtx";
import { pointerCursorHandlers } from "./stageCursor";
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
   * When false, the module body does not show a pointer cursor (e.g. doorbell
   * shells where only the press pad is clickable).
   */
  bodyPointer?: boolean;
  /**
   * How many connection nodes to place on each edge.
   * Omitted sides get none; defaults to one on every side.
   */
  terminals?: TerminalCounts;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  children?: ReactNode;
};

/**
 * Shared Konva shell for circuit modules (switches, transformers, buttons, etc.).
 * Renders the positioned group, tinted box, title, and edge connection nodes;
 * children fill the interior. Terminal wiring UI comes from AppCtx.
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
  bodyPointer = true,
  terminals = DEFAULT_TERMINALS,
  onDragMove,
  onDragEnd,
  children,
}: ModuleProps) {
  const { wireMode, pendingTerminalId, onTerminalPointerDown } = useAppCtx();
  const sides = listTerminals(terminals, width, height);
  const clickCursor = pointerCursorHandlers();

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
        {...(bodyPointer ? clickCursor : {})}
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
        const lit = wireMode || isPending;
        return (
          <Circle
            key={tid}
            x={tx}
            y={ty}
            radius={TERMINAL_RADIUS}
            fill={isPending ? "#93c5fd" : lit ? "#dbeafe" : "#f8fafc"}
            stroke={isPending ? "#1d4ed8" : lit ? "#3b82f6" : "#475569"}
            strokeWidth={isPending ? 3 : lit ? 2.5 : 2}
            hitStrokeWidth={12}
            name={`terminal-${tid}`}
            id={tid}
            {...clickCursor}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onTerminalPointerDown(tid, e);
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              onTerminalPointerDown(tid, e);
            }}
          />
        );
      })}
    </Group>
  );
}
