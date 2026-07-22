import type { KonvaEventObject } from "konva/lib/Node";
import { Module } from "./Module";

const WIDTH = 160;
const HEIGHT = 120;

type SwitchProps = {
  id: string;
  x?: number;
  y?: number;
  title?: string;
  pendingTerminalId?: string | null;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onTerminalPointerDown?: (
    terminalId: string,
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
};

/**
 * Placeholder switch built on the shared Module shell.
 */
export function Switch({
  id,
  x = 0,
  y = 0,
  title = "Switch",
  pendingTerminalId = null,
  onDragMove,
  onDragEnd,
  onTerminalPointerDown,
}: SwitchProps) {
  return (
    <Module
      id={id}
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      pendingTerminalId={pendingTerminalId}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTerminalPointerDown={onTerminalPointerDown}
    />
  );
}

export const SWITCH_SIZE = { width: WIDTH, height: HEIGHT } as const;
