import { Module } from "./Module";

const WIDTH = 160;
const HEIGHT = 120;

type SwitchProps = {
  id: string;
  x?: number;
  y?: number;
  title?: string;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
};

/**
 * Placeholder switch built on the shared Module shell.
 */
export function Switch({
  id,
  x = 0,
  y = 0,
  title = "Switch",
  onDragMove,
  onDragEnd,
}: SwitchProps) {
  return (
    <Module
      id={id}
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
}

export const SWITCH_SIZE = { width: WIDTH, height: HEIGHT } as const;
