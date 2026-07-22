import { Module } from "./Module";

const WIDTH = 160;
const HEIGHT = 120;

type SwitchProps = {
  x?: number;
  y?: number;
  title?: string;
};

/**
 * Placeholder switch built on the shared Module shell.
 */
export function Switch({ x = 0, y = 0, title = "Switch" }: SwitchProps) {
  return <Module x={x} y={y} width={WIDTH} height={HEIGHT} title={title} />;
}
