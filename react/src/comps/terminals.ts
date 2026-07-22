/** Distance from shell edge to terminal center so wire stubs stay visible. */
export const TERMINAL_OUTSET = 20;
export const TERMINAL_RADIUS = 7;

export type TerminalSide = "top" | "right" | "bottom" | "left";

/**
 * Per-side terminal layout: a count, or an ordered list of optional labels
 * (empty / undefined entries still place a terminal, just unlabeled).
 */
export type TerminalSideConfig = number | readonly (string | undefined)[];

export type TerminalCounts = Partial<Record<TerminalSide, TerminalSideConfig>>;

export type Point = { x: number; y: number };

export type TerminalSpec = {
  side: TerminalSide;
  index: number;
  x: number;
  y: number;
  /** Optional short label drawn near the pad (e.g. "L1", "N"). */
  label?: string;
};

export const DEFAULT_TERMINALS: TerminalCounts = {
  top: 1,
  right: 1,
  bottom: 1,
  left: 1,
};

/**
 * How many terminals a side config places.
 */
export function terminalSideCount(config: TerminalSideConfig | undefined) {
  if (config === undefined) return 0;
  return typeof config === "number" ? config : config.length;
}

/**
 * Evenly spaced positions along an edge length (centers between the ends).
 */
function spacedAlong(count: number, length: number) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * length);
}

/**
 * Local centers for terminals sitting just outside one shell edge.
 */
export function terminalPositions(
  side: TerminalSide,
  count: number,
  width: number,
  height: number,
): Point[] {
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
 * Lists every terminal on a module with local coordinates and optional labels.
 */
export function listTerminals(
  terminals: TerminalCounts,
  width: number,
  height: number,
): TerminalSpec[] {
  return (Object.keys(terminals) as TerminalSide[]).flatMap((side) => {
    const config = terminals[side];
    const count = terminalSideCount(config);
    const labels = typeof config === "number" || config === undefined ? null : config;
    return terminalPositions(side, count, width, height).map((pos, index) => {
      const raw = labels?.[index];
      const label = raw && raw.length > 0 ? raw : undefined;
      return {
        side,
        index,
        ...pos,
        ...(label ? { label } : {}),
      };
    });
  });
}

/**
 * Local offset from a terminal center toward the module body, centered in the
 * white gap between the pad edge and the shell.
 */
export function terminalLabelOffset(side: TerminalSide): Point {
  const gapMid = TERMINAL_RADIUS + (TERMINAL_OUTSET - TERMINAL_RADIUS) / 2;
  switch (side) {
    case "top":
      return { x: 0, y: gapMid };
    case "bottom":
      return { x: 0, y: -gapMid };
    case "left":
      return { x: gapMid, y: 0 };
    case "right":
      return { x: -gapMid, y: 0 };
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

/**
 * Builds a stable key for a terminal (component id + side + index).
 */
export function terminalKey(
  componentId: string,
  side: TerminalSide,
  index: number,
) {
  return `${componentId}:${side}:${index}`;
}

/**
 * Parses a terminal key into component id, side, and index.
 */
export function parseTerminalKey(key: string) {
  const [componentId, side, indexStr] = key.split(":");
  if (!componentId || !side || indexStr === undefined) return null;
  const index = Number(indexStr);
  if (!Number.isInteger(index)) return null;
  if (side !== "top" && side !== "right" && side !== "bottom" && side !== "left") {
    return null;
  }
  return { componentId, side, index };
}

/**
 * Converts a local terminal position into world (layer) coordinates.
 */
export function worldTerminalPos(modulePos: Point, localPos: Point): Point {
  return {
    x: modulePos.x + localPos.x,
    y: modulePos.y + localPos.y,
  };
}

/**
 * Canonical unordered pair key so A→B and B→A are treated as the same wire.
 */
export function wirePairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
