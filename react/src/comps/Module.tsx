import type { ReactNode } from "react";
import { Group, Rect, Text } from "react-konva";

type ModuleProps = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  title: string;
  fill?: string;
  stroke?: string;
  draggable?: boolean;
  children?: ReactNode;
};

/**
 * Shared Konva shell for circuit modules (switches, transformers, buttons, etc.).
 * Renders the positioned group, tinted box, and title; children fill the interior.
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
  children,
}: ModuleProps) {
  return (
    <Group x={x} y={y} draggable={draggable}>
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="rgba(37, 99, 235, 0.12)"
        shadowBlur={10}
        shadowOffsetY={2}
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
    </Group>
  );
}
