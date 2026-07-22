import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Circle, Layer, Line, Stage } from "react-konva";
import { AppCtxProvider } from "./appCtx";
import { DoorbellButton, DOORBELL_SIZE } from "./comps/DoorbellButton";
import { Switch, SWITCH_SIZE } from "./comps/Switch";
import { Module } from "./comps/Module";
import {
  pointerCursorHandlers,
  setStageCursor,
  STAGE_DEFAULT_CURSOR,
} from "./comps/stageCursor";
import {
  DEFAULT_TERMINALS,
  listTerminals,
  parseTerminalKey,
  wirePairKey,
  worldTerminalPos,
  type Point,
  type TerminalCounts,
} from "./comps/terminals";
import {
  WIRE_TENSION,
  wireSegmentMidpoints,
} from "./comps/wirePath";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const BUTTON_SCALE_BY = 1.2;
/** Pinch / ctrl+wheel sensitivity (higher = faster zoom). */
const PINCH_ZOOM_INTENSITY = 0.01;
/** How many pixels of content must stay on-screen at each edge. */
const EDGE_MARGIN = 72;
/** Pointer travel (stage px) before a terminal press counts as a wire drag. */
const WIRE_DRAG_THRESHOLD = 6;
/** Pointer travel (stage px) before an empty-canvas press counts as a pan. */
const PAN_DRAG_THRESHOLD = 4;
/** Radius of bend / midpoint handles on a selected wire. */
const BEND_HANDLE_RADIUS = 6;
/** Colored stroke width for an unselected wire. */
const WIRE_STROKE_WIDTH = 3;
/** Colored stroke width for the selected wire. */
const WIRE_STROKE_WIDTH_SELECTED = 5;
/** Extra width added under the colored stroke so crossings stay readable. */
const WIRE_UNDERSTROKE_PAD = 5;
/** Matches `.stage-wrap` background so the halo looks like a canvas cutout. */
const WIRE_UNDERSTROKE_COLOR = "#e8e8e8";

type ButtonId = "front" | "rear";
type ModuleId = ButtonId | "switch" | "extra";

type PressedState = Record<ButtonId, boolean>;

type ViewState = {
  scale: number;
  x: number;
  y: number;
};

type StageSize = {
  width: number;
  height: number;
};

type ContentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type ModuleLayout = {
  width: number;
  height: number;
  terminals: TerminalCounts;
};

type Wire = {
  id: string;
  from: string;
  to: string;
  /** World-space bend points between the two terminals. */
  bends: Point[];
  color: WireColor;
};

type WireColor =
  | "black"
  | "white"
  | "red"
  | "blue"
  | "yellow"
  | "orange"
  | "green"
  | "purple";

const WIRE_COLORS: readonly {
  id: WireColor;
  label: string;
  hex: string;
}[] = [
  { id: "black", label: "Black", hex: "#0f172a" },
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "red", label: "Red", hex: "#dc2626" },
  { id: "blue", label: "Blue", hex: "#2563eb" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "orange", label: "Orange", hex: "#ea580c" },
  { id: "green", label: "Green", hex: "#16a34a" },
  { id: "purple", label: "Purple", hex: "#9333ea" },
];

const DEFAULT_WIRE_COLOR: WireColor = "black";

/**
 * Resolves a wire color id to a CSS hex stroke.
 */
function wireColorHex(color: WireColor): string {
  switch (color) {
    case "black":
      return "#0f172a";
    case "white":
      return "#ffffff";
    case "red":
      return "#dc2626";
    case "blue":
      return "#2563eb";
    case "yellow":
      return "#eab308";
    case "orange":
      return "#ea580c";
    case "green":
      return "#16a34a";
    case "purple":
      return "#9333ea";
    default: {
      const _exhaustive: never = color;
      throw new Error(`Unhandled wire color: ${_exhaustive}`);
    }
  }
}

type WireDraft =
  | { kind: "pending"; from: string }
  | { kind: "drag"; from: string; pointer: Point };

type WireGesture = {
  from: string;
  start: Point;
  dragging: boolean;
};

/** Floating wire actions menu anchored to a world-space click point. */
type WireMenu = {
  wireId: string;
  /** World-space anchor so the menu stays on the wire while panning/zooming. */
  world: Point;
  /** Whether the color swatch list is expanded. */
  colorPickerOpen: boolean;
};

/**
 * Trash can icon for the wire actions menu delete button.
 */
function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 4.5h9M6.5 4.5V3.25A.75.75 0 0 1 7.25 2.5h1.5a.75.75 0 0 1 .75.75V4.5m-5 0 .6 8.1a1 1 0 0 0 1 .9h3.3a1 1 0 0 0 1-.9l.6-8.1M6.5 7v4.5M9.5 7v4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Small chevron indicating more wire color choices are available.
 */
function ColorMoreIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * X icon for dismissing the wire actions menu.
 */
function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type WireActionsMenuProps = {
  menu: WireMenu;
  /** Stage-container pixel position of the world anchor. */
  screen: Point;
  /** Stage wrap size used to keep the menu on-screen. */
  viewport: StageSize;
  color: WireColor;
  /** Closes the menu when the user presses outside it. */
  onDismiss: () => void;
  onDelete: () => void;
  onToggleColorPicker: () => void;
  onPickColor: (color: WireColor) => void;
};

const WIRE_MENU_GAP = 10;
const WIRE_MENU_MARGIN = 8;

/**
 * Floating delete + color controls for a selected wire.
 * Flips below the anchor (and clamps horizontally) when near screen edges.
 */
function WireActionsMenu({
  menu,
  screen,
  viewport,
  color,
  onDismiss,
  onDelete,
  onToggleColorPicker,
  onPickColor,
}: WireActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: screen.x, top: screen.y });
  const current = WIRE_COLORS.find((entry) => entry.id === color) ?? WIRE_COLORS[0];

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width <= 0 || height <= 0) return;

    let top = screen.y - height - WIRE_MENU_GAP;
    if (top < WIRE_MENU_MARGIN) {
      top = screen.y + WIRE_MENU_GAP;
    }
    if (top + height > viewport.height - WIRE_MENU_MARGIN) {
      top = Math.max(
        WIRE_MENU_MARGIN,
        viewport.height - WIRE_MENU_MARGIN - height,
      );
    }

    let left = screen.x - width / 2;
    left = Math.min(
      Math.max(left, WIRE_MENU_MARGIN),
      Math.max(WIRE_MENU_MARGIN, viewport.width - WIRE_MENU_MARGIN - width),
    );

    setPos((prev) =>
      prev.left === left && prev.top === top ? prev : { left, top },
    );
  }, [
    screen.x,
    screen.y,
    viewport.width,
    viewport.height,
    menu.colorPickerOpen,
  ]);

  // Close when pressing anywhere except the menu itself (wire, stage, toolbar, …).
  useEffect(() => {
    /**
     * Dismisses the menu on an outside pointer press.
     */
    function onPointerDown(evt: PointerEvent) {
      const el = menuRef.current;
      if (!el) return;
      const target = evt.target;
      if (target instanceof Node && el.contains(target)) return;
      onDismiss();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onDismiss]);

  return (
    <div
      ref={menuRef}
      className="wire-menu"
      role="menu"
      aria-label="Wire actions"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="wire-menu-row">
        <button
          type="button"
          className="wire-menu-item wire-menu-item--danger"
          role="menuitem"
          aria-label="Delete wire"
          title="Delete wire"
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
        <button
          type="button"
          className="wire-menu-color-trigger"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={menu.colorPickerOpen}
          aria-label={`Wire color: ${current.label}. Choose color`}
          title="Choose color"
          onClick={onToggleColorPicker}
        >
          <span
            className="wire-menu-swatch"
            style={{ backgroundColor: current.hex }}
          />
          <ColorMoreIcon />
        </button>
        <button
          type="button"
          className="wire-menu-item"
          role="menuitem"
          aria-label="Close"
          title="Close"
          onClick={onDismiss}
        >
          <CloseIcon />
        </button>
      </div>
      {menu.colorPickerOpen ? (
        <div
          className="wire-menu-colors"
          role="group"
          aria-label="Wire color options"
        >
          {WIRE_COLORS.map((entry) => {
            const selected = entry.id === color;
            return (
              <button
                key={entry.id}
                type="button"
                className={
                  selected
                    ? "wire-menu-swatch wire-menu-swatch--selected"
                    : "wire-menu-swatch"
                }
                role="menuitemradio"
                aria-checked={selected}
                aria-label={entry.label}
                title={entry.label}
                style={{ backgroundColor: entry.hex }}
                onClick={() => onPickColor(entry.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fallback world-space box until the stage measures live module bounds.
 * Pan stops once the content box is about to leave the viewport.
 */
const INITIAL_CONTENT_BOUNDS: ContentBounds = {
  minX: 0,
  minY: 0,
  maxX: 580,
  maxY: 280,
};

const INITIAL_VIEW: ViewState = { scale: 1, x: 0, y: 0 };

const INITIAL_POSITIONS: Record<ModuleId, Point> = {
  front: { x: 120, y: 160 },
  rear: { x: 420, y: 160 },
  switch: { x: 0, y: 0 },
  extra: { x: 280, y: 40 },
};

const MODULE_LAYOUTS: Record<ModuleId, ModuleLayout> = {
  front: {
    width: DOORBELL_SIZE.width,
    height: DOORBELL_SIZE.height,
    terminals: { top: 3 },
  },
  rear: {
    width: DOORBELL_SIZE.width,
    height: DOORBELL_SIZE.height,
    terminals: { top: 3 },
  },
  switch: {
    width: SWITCH_SIZE.width,
    height: SWITCH_SIZE.height,
    terminals: DEFAULT_TERMINALS,
  },
  extra: {
    width: 100,
    height: 100,
    terminals: DEFAULT_TERMINALS,
  },
};

/**
 * Clamps a number into [min, max], centering when the range is empty.
 */
function clampRange(value: number, min: number, max: number) {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps stage scale between zoom limits.
 */
function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Keeps content from panning completely off-screen.
 * Leaves EDGE_MARGIN pixels of the content box visible at the limit.
 */
function clampView(
  view: ViewState,
  viewport: StageSize,
  content: ContentBounds,
): ViewState {
  if (viewport.width <= 0 || viewport.height <= 0) return view;

  const { scale } = view;
  const minX = EDGE_MARGIN - content.maxX * scale;
  const maxX = viewport.width - EDGE_MARGIN - content.minX * scale;
  const minY = EDGE_MARGIN - content.maxY * scale;
  const maxY = viewport.height - EDGE_MARGIN - content.minY * scale;

  return {
    scale,
    x: clampRange(view.x, minX, maxX),
    y: clampRange(view.y, minY, maxY),
  };
}

/**
 * Converts a Konva client rect into world-space content bounds.
 */
function boundsFromClientRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): ContentBounds {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };
}

/**
 * Measures the layer's module box in stage (world) coordinates.
 */
function measureContentBounds(layer: KonvaLayer): ContentBounds | null {
  const stage = layer.getStage();
  if (!stage) return null;
  const rect = layer.getClientRect({ relativeTo: stage, skipShadow: true });
  if (rect.width <= 0 || rect.height <= 0) return null;
  return boundsFromClientRect(rect);
}

/**
 * Zooms the stage around a pointer so that point stays under the cursor.
 */
function zoomAt(
  view: ViewState,
  pointer: { x: number; y: number },
  nextScale: number,
  viewport: StageSize,
  content: ContentBounds,
): ViewState {
  const scale = clampScale(nextScale);
  const pointTo = {
    x: (pointer.x - view.x) / view.scale,
    y: (pointer.y - view.y) / view.scale,
  };
  return clampView(
    {
      scale,
      x: pointer.x - pointTo.x * scale,
      y: pointer.y - pointTo.y * scale,
    },
    viewport,
    content,
  );
}

/**
 * Converts a stage pointer into world (layer) coordinates.
 */
function pointerToWorld(
  pointer: Point,
  view: ViewState,
): Point {
  return {
    x: (pointer.x - view.x) / view.scale,
    y: (pointer.y - view.y) / view.scale,
  };
}

/**
 * Projects a world point into stage-container pixel coordinates.
 */
function worldToPointer(world: Point, view: ViewState): Point {
  return {
    x: world.x * view.scale + view.x,
    y: world.y * view.scale + view.y,
  };
}

/**
 * Reads a terminal id from a Konva node or one of its ancestors.
 */
function terminalIdFromNode(node: KonvaNode | null | undefined): string | null {
  let current: KonvaNode | null | undefined = node;
  while (current) {
    const named = current.name?.() ?? "";
    if (named.startsWith("terminal-")) {
      return named.slice("terminal-".length);
    }
    const nodeId = current.id?.() ?? "";
    if (nodeId.includes(":")) return nodeId;
    current = current.getParent?.() ?? null;
  }
  return null;
}

/**
 * Resolves the world-space center of a terminal key from module layouts/positions.
 */
function resolveTerminalWorldPos(
  key: string,
  positions: Record<string, Point>,
): Point | null {
  const parsed = parseTerminalKey(key);
  if (!parsed) return null;
  const layout = MODULE_LAYOUTS[parsed.componentId as ModuleId];
  const modulePos = positions[parsed.componentId];
  if (!layout || !modulePos) return null;

  const local = listTerminals(layout.terminals, layout.width, layout.height).find(
    (t) => t.side === parsed.side && t.index === parsed.index,
  );
  if (!local) return null;
  return worldTerminalPos(modulePos, local);
}

/**
 * Returns whether a wire between these endpoints already exists.
 */
function hasWireBetween(wires: Wire[], a: string, b: string) {
  const pair = wirePairKey(a, b);
  return wires.some((w) => wirePairKey(w.from, w.to) === pair);
}

/**
 * Builds the flat Konva points array: from → bends → to.
 */
function buildWireFlatPoints(from: Point, bends: Point[], to: Point): number[] {
  const points = [from.x, from.y];
  for (const bend of bends) {
    points.push(bend.x, bend.y);
  }
  points.push(to.x, to.y);
  return points;
}

/**
 * Ordered vertices along a wire (terminals + bends).
 */
function wireVertices(from: Point, bends: Point[], to: Point): Point[] {
  return [from, ...bends, to];
}

/**
 * Squared distance from a point to a line segment.
 */
function distToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return ex * ex + ey * ey;
}

/**
 * Finds which polyline segment is closest to a world point (bend insert index).
 */
function findClosestSegmentIndex(
  from: Point,
  bends: Point[],
  to: Point,
  point: Point,
) {
  const verts = wireVertices(from, bends, to);
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < verts.length - 1; i += 1) {
    const a = verts[i];
    const b = verts[i + 1];
    const dist = distToSegmentSq(point.x, point.y, a.x, a.y, b.x, b.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

type LabLayerProps = {
  pressed: PressedState;
  positions: Record<ModuleId, Point>;
  wires: Wire[];
  selectedWireId: string | null;
  draft: WireDraft | null;
  onPressedChange: (id: ButtonId, pressed: boolean) => void;
  onModuleDragMove: (id: string, x: number, y: number) => void;
  onModuleDragEnd: (id: string, x: number, y: number) => void;
  onWireSelect: (
    id: string,
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  onWireAddBend: (
    id: string,
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  onBendMove: (id: string, bendIndex: number, x: number, y: number) => void;
  onBendRemove: (id: string, bendIndex: number) => void;
  onMidpointPointerDown: (
    id: string,
    segmentIndex: number,
    e: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  onContentBoundsChange: () => void;
};

/**
 * Circuit shapes live here so pan/zoom view updates on App do not
 * re-reconcile every module — only Stage transform props change.
 */
const LabLayer = memo(function LabLayer({
  pressed,
  positions,
  wires,
  selectedWireId,
  draft,
  onPressedChange,
  onModuleDragMove,
  onModuleDragEnd,
  onWireSelect,
  onWireAddBend,
  onBendMove,
  onBendRemove,
  onMidpointPointerDown,
  onContentBoundsChange,
}: LabLayerProps) {
  const renderedWires = wires
    .map((wire) => {
      const from = resolveTerminalWorldPos(wire.from, positions);
      const to = resolveTerminalWorldPos(wire.to, positions);
      if (!from || !to) return null;
      return {
        id: wire.id,
        bends: wire.bends,
        color: wire.color,
        from,
        to,
        points: buildWireFlatPoints(from, wire.bends, to),
      };
    })
    .filter(
      (
        w,
      ): w is {
        id: string;
        bends: Point[];
        color: WireColor;
        from: Point;
        to: Point;
        points: number[];
      } => w !== null,
    );

  // Selected wire paints last among wires so its halo + stroke sit on top.
  const orderedWires =
    selectedWireId == null
      ? renderedWires
      : [
          ...renderedWires.filter((w) => w.id !== selectedWireId),
          ...renderedWires.filter((w) => w.id === selectedWireId),
        ];

  const draftFrom =
    draft !== null ? resolveTerminalWorldPos(draft.from, positions) : null;
  const draftPoints =
    draft?.kind === "drag" && draftFrom
      ? [draftFrom.x, draftFrom.y, draft.pointer.x, draft.pointer.y]
      : null;
  const clickCursor = pointerCursorHandlers();

  return (
    <Layer onDragEnd={onContentBoundsChange}>
      {orderedWires.map((wire) => {
        const selected = wire.id === selectedWireId;
        const verts = wireVertices(wire.from, wire.bends, wire.to);
        const strokeWidth = selected
          ? WIRE_STROKE_WIDTH_SELECTED
          : WIRE_STROKE_WIDTH;
        const sharedLine = {
          points: wire.points,
          lineCap: "round" as const,
          lineJoin: "round" as const,
          tension: WIRE_TENSION,
        };
        return (
          <Fragment key={wire.id}>
            <Line
              {...sharedLine}
              stroke={WIRE_UNDERSTROKE_COLOR}
              strokeWidth={strokeWidth + WIRE_UNDERSTROKE_PAD}
              listening={false}
            />
            <Line
              name={`wire-${wire.id}`}
              {...sharedLine}
              stroke={wireColorHex(wire.color)}
              strokeWidth={strokeWidth}
              hitStrokeWidth={16}
              shadowColor={wire.color === "white" ? "#64748b" : undefined}
              shadowBlur={wire.color === "white" ? 2 : 0}
              shadowOpacity={wire.color === "white" ? 0.55 : 0}
              {...clickCursor}
              onClick={(e) => {
                e.cancelBubble = true;
                onWireSelect(wire.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onWireSelect(wire.id, e);
              }}
              onDblClick={(e) => {
                e.cancelBubble = true;
                onWireAddBend(wire.id, e);
              }}
              onDblTap={(e) => {
                e.cancelBubble = true;
                onWireAddBend(wire.id, e);
              }}
            />
            {selected
              ? wireSegmentMidpoints(verts, WIRE_TENSION).map((mid, segmentIndex) => (
                    <Circle
                      key={`${wire.id}-mid-${segmentIndex}`}
                      name="bend-midpoint"
                      x={mid.x}
                      y={mid.y}
                      radius={BEND_HANDLE_RADIUS - 1}
                      fill="#dbeafe"
                      stroke="#93c5fd"
                      strokeWidth={1.5}
                      opacity={0.9}
                      {...clickCursor}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        onMidpointPointerDown(wire.id, segmentIndex, e);
                      }}
                      onTouchStart={(e) => {
                        e.cancelBubble = true;
                        onMidpointPointerDown(wire.id, segmentIndex, e);
                      }}
                    />
                  ))
              : null}
            {selected
              ? wire.bends.map((bend, bendIndex) => (
                  <Circle
                    key={`${wire.id}-bend-${bendIndex}`}
                    name="bend-handle"
                    x={bend.x}
                    y={bend.y}
                    radius={BEND_HANDLE_RADIUS}
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth={2}
                    draggable
                    {...clickCursor}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                    }}
                    onTouchStart={(e) => {
                      e.cancelBubble = true;
                    }}
                    onDragMove={(e) => {
                      onBendMove(
                        wire.id,
                        bendIndex,
                        e.target.x(),
                        e.target.y(),
                      );
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      onBendRemove(wire.id, bendIndex);
                    }}
                    onDblTap={(e) => {
                      e.cancelBubble = true;
                      onBendRemove(wire.id, bendIndex);
                    }}
                  />
                ))
              : null}
          </Fragment>
        );
      })}
      {draftPoints ? (
        <Line
          points={draftPoints}
          stroke="#2563eb"
          strokeWidth={2}
          dash={[8, 6]}
          lineCap="round"
          listening={false}
        />
      ) : null}
      <DoorbellButton
        id="front"
        x={positions.front.x}
        y={positions.front.y}
        title="Front"
        pressed={pressed.front}
        onPressedChange={onPressedChange}
        onDragMove={onModuleDragMove}
        onDragEnd={onModuleDragEnd}
      />
      <DoorbellButton
        id="rear"
        x={positions.rear.x}
        y={positions.rear.y}
        title="Rear"
        pressed={pressed.rear}
        onPressedChange={onPressedChange}
        onDragMove={onModuleDragMove}
        onDragEnd={onModuleDragEnd}
      />
      <Switch
        id="switch"
        x={positions.switch.x}
        y={positions.switch.y}
        onDragMove={onModuleDragMove}
        onDragEnd={onModuleDragEnd}
      />
      <Module
        id="extra"
        x={positions.extra.x}
        y={positions.extra.y}
        width={100}
        height={100}
        title="Switch"
        onDragMove={onModuleDragMove}
        onDragEnd={onModuleDragEnd}
      />
    </Layer>
  );
});

/**
 * Experimental React + Konva lab shell.
 * Keeps canvas pieces as declarative components driven by React state.
 */
export function App() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage>(null);
  const contentBoundsRef = useRef(INITIAL_CONTENT_BOUNDS);
  const viewRef = useRef(INITIAL_VIEW);
  const gestureRef = useRef<WireGesture | null>(null);
  const draftRef = useRef<WireDraft | null>(null);
  const positionsRef = useRef(INITIAL_POSITIONS);
  /** True after an empty-canvas drag so the following click does not clear selection. */
  const suppressStageClickRef = useRef(false);
  /**
   * True after an outside press dismisses the wire menu, so a following wire
   * click in the same gesture does not immediately reopen it.
   */
  const suppressWireMenuOpenRef = useRef(false);
  const wireMenuRef = useRef<WireMenu | null>(null);
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });
  const [pressed, setPressed] = useState<PressedState>({
    front: false,
    rear: false,
  });
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [contentBounds, setContentBounds] = useState<ContentBounds>(
    INITIAL_CONTENT_BOUNDS,
  );
  const [positions, setPositions] =
    useState<Record<ModuleId, Point>>(INITIAL_POSITIONS);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wireMenu, setWireMenu] = useState<WireMenu | null>(null);
  const [lastWireColor, setLastWireColor] =
    useState<WireColor>(DEFAULT_WIRE_COLOR);
  const [draft, setDraft] = useState<WireDraft | null>(null);

  contentBoundsRef.current = contentBounds;
  viewRef.current = view;
  draftRef.current = draft;
  positionsRef.current = positions;
  wireMenuRef.current = wireMenu;

  const pendingTerminalId =
    draft?.kind === "pending" || draft?.kind === "drag" ? draft.from : null;
  const wireMode = draft !== null;

  /**
   * Reads live module positions from the stage and updates pan limits.
   */
  const syncContentBounds = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const layer = stage.getLayers()[0];
    if (!layer) return;
    const next = measureContentBounds(layer);
    if (!next) return;

    const prev = contentBoundsRef.current;
    if (
      prev.minX === next.minX &&
      prev.minY === next.minY &&
      prev.maxX === next.maxX &&
      prev.maxY === next.maxY
    ) {
      return;
    }

    contentBoundsRef.current = next;
    setContentBounds(next);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    /**
     * Syncs the Konva stage to the wrap's current pixel size.
     */
    function updateSize() {
      const node = wrapRef.current;
      if (!node) return;
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initial measure once the stage exists at a real size.
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    syncContentBounds();
  }, [size.width, size.height, syncContentBounds]);

  // Re-clamp pan when the viewport or live content bounds change.
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    setView((prev) => clampView(prev, size, contentBounds));
  }, [size, contentBounds]);

  const status = useMemo(() => {
    if (draft?.kind === "pending") {
      return "Click another terminal to connect";
    }
    if (draft?.kind === "drag") {
      return "Drop on a terminal to connect";
    }
    if (selectedWireId) {
      return "Wire selected — use trash to delete · drag nodes to reshape";
    }
    const active = Object.entries(pressed)
      .filter(([, isDown]) => isDown)
      .map(([id]) => id);
    if (active.length > 0) return `Pressed: ${active.join(", ")}`;
    if (wires.length > 0) {
      return `${wires.length} wire${wires.length === 1 ? "" : "s"} — click a wire to select`;
    }
    return "Idle — drag or click terminals to wire";
  }, [draft, pressed, selectedWireId, wires.length]);

  /**
   * Updates one button's pressed flag.
   * Stable identity so memoized LabLayer can skip pan/zoom re-renders.
   */
  const setButtonPressed = useCallback((id: ButtonId, isDown: boolean) => {
    setPressed((prev) => ({ ...prev, [id]: isDown }));
  }, []);

  /**
   * Updates a module's world position while dragging (keeps wires attached).
   */
  const handleModuleDragMove = useCallback((id: string, x: number, y: number) => {
    setPositions((prev) => {
      if (!(id in prev)) return prev;
      const current = prev[id as ModuleId];
      if (current.x === x && current.y === y) return prev;
      return { ...prev, [id]: { x, y } };
    });
  }, []);

  /**
   * Commits a module's position after drag and refreshes pan limits.
   */
  const handleModuleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      handleModuleDragMove(id, x, y);
      syncContentBounds();
    },
    [handleModuleDragMove, syncContentBounds],
  );

  /**
   * Clears wire selection and the floating wire menu.
   */
  const clearWireSelection = useCallback(() => {
    setSelectedWireId(null);
    wireMenuRef.current = null;
    setWireMenu(null);
  }, []);

  /**
   * Closes the wire actions menu without clearing wire selection.
   * Suppresses reopening from the same press/click gesture (e.g. on a wire).
   */
  const dismissWireMenu = useCallback(() => {
    if (!wireMenuRef.current) return;
    suppressWireMenuOpenRef.current = true;
    wireMenuRef.current = null;
    setWireMenu(null);
    window.setTimeout(() => {
      suppressWireMenuOpenRef.current = false;
    }, 0);
  }, []);

  /**
   * Removes a wire and closes selection / menu.
   */
  const deleteWire = useCallback((id: string) => {
    setWires((prev) => prev.filter((w) => w.id !== id));
    setSelectedWireId(null);
    wireMenuRef.current = null;
    setWireMenu(null);
  }, []);

  /**
   * Sets the color of an existing wire and remembers it for new wires.
   */
  const setWireColor = useCallback((id: string, color: WireColor) => {
    setLastWireColor(color);
    setWires((prev) =>
      prev.map((wire) => (wire.id === id ? { ...wire, color } : wire)),
    );
  }, []);

  /**
   * Adds a wire between two terminals when the pair is valid and new.
   */
  const connectTerminals = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      setSelectedWireId(null);
      setWireMenu(null);
      setWires((prev) => {
        if (hasWireBetween(prev, from, to)) return prev;
        return [
          ...prev,
          {
            id: `wire-${from}-${to}-${prev.length}`,
            from,
            to,
            bends: [],
            color: lastWireColor,
          },
        ];
      });
    },
    [lastWireColor],
  );

  /**
   * Selects a wire and opens the actions menu at the click point.
   * If the menu is already open, closes it instead (click-away, including on the wire).
   */
  const handleWireSelect = useCallback(
    (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      setDraft(null);
      gestureRef.current = null;
      setSelectedWireId(id);

      // Outside dismiss (or an already-open menu) should not reopen on this click.
      if (suppressWireMenuOpenRef.current || wireMenuRef.current) {
        suppressWireMenuOpenRef.current = false;
        wireMenuRef.current = null;
        setWireMenu(null);
        return;
      }

      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) {
        wireMenuRef.current = null;
        setWireMenu(null);
        return;
      }
      const nextMenu: WireMenu = {
        wireId: id,
        world: pointerToWorld(pointer, viewRef.current),
        colorPickerOpen: false,
      };
      wireMenuRef.current = nextMenu;
      setWireMenu(nextMenu);
    },
    [],
  );

  /**
   * Moves one bend point on a wire (while dragging a handle).
   */
  const handleBendMove = useCallback(
    (id: string, bendIndex: number, x: number, y: number) => {
      setWires((prev) =>
        prev.map((wire) => {
          if (wire.id !== id) return wire;
          if (bendIndex < 0 || bendIndex >= wire.bends.length) return wire;
          const bends = wire.bends.map((bend, i) =>
            i === bendIndex ? { x, y } : bend,
          );
          return { ...wire, bends };
        }),
      );
    },
    [],
  );

  /**
   * Removes a bend point (double-click handle).
   */
  const handleBendRemove = useCallback((id: string, bendIndex: number) => {
    setWires((prev) =>
      prev.map((wire) => {
        if (wire.id !== id) return wire;
        if (bendIndex < 0 || bendIndex >= wire.bends.length) return wire;
        return {
          ...wire,
          bends: wire.bends.filter((_, i) => i !== bendIndex),
        };
      }),
    );
  }, []);

  /**
   * Inserts a bend on the closest segment at the pointer (double-click wire).
   */
  const handleWireAddBend = useCallback(
    (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const world = pointerToWorld(pointer, viewRef.current);

      setWires((prev) =>
        prev.map((wire) => {
          if (wire.id !== id) return wire;
          const from = resolveTerminalWorldPos(wire.from, positionsRef.current);
          const to = resolveTerminalWorldPos(wire.to, positionsRef.current);
          if (!from || !to) return wire;
          const segmentIndex = findClosestSegmentIndex(
            from,
            wire.bends,
            to,
            world,
          );
          const bends = [...wire.bends];
          bends.splice(segmentIndex, 0, world);
          return { ...wire, bends };
        }),
      );
      setSelectedWireId(id);
      setWireMenu(null);
    },
    [],
  );

  /**
   * Starts a drag from a mid-segment handle: after a short move, inserts a bend
   * and tracks it until pointer up (avoids remounting mid-drag).
   */
  const handleMidpointPointerDown = useCallback(
    (
      id: string,
      segmentIndex: number,
      e: KonvaEventObject<MouseEvent | TouchEvent>,
    ) => {
      e.evt.preventDefault();
      const maybeStage = e.target.getStage();
      if (!maybeStage) return;
      const stageNode: KonvaStage = maybeStage;
      const startPointer = stageNode.getPointerPosition();
      if (!startPointer) return;
      const start = { x: startPointer.x, y: startPointer.y };

      let inserted = false;
      const bendIndex = segmentIndex;

      /**
       * Inserts the bend once the pointer moves, then updates its position.
       */
      function onMove(evt: KonvaEventObject<MouseEvent | TouchEvent>) {
        evt.evt.preventDefault();
        const pos = stageNode.getPointerPosition();
        if (!pos) return;
        const world = pointerToWorld(pos, viewRef.current);

        if (!inserted) {
          const dx = pos.x - start.x;
          const dy = pos.y - start.y;
          if (dx * dx + dy * dy < WIRE_DRAG_THRESHOLD * WIRE_DRAG_THRESHOLD) {
            return;
          }
          inserted = true;
          setWires((prev) =>
            prev.map((wire) => {
              if (wire.id !== id) return wire;
              const bends = [...wire.bends];
              bends.splice(segmentIndex, 0, world);
              return { ...wire, bends };
            }),
          );
          return;
        }

        setWires((prev) =>
          prev.map((wire) => {
            if (wire.id !== id) return wire;
            if (bendIndex < 0 || bendIndex >= wire.bends.length) return wire;
            const bends = wire.bends.map((bend, i) =>
              i === bendIndex ? world : bend,
            );
            return { ...wire, bends };
          }),
        );
      }

      /**
       * Ends the mid-segment bend gesture.
       */
      function onUp() {
        stageNode.off(".bendGesture");
      }

      stageNode.on("mousemove.bendGesture touchmove.bendGesture", onMove);
      stageNode.on("mouseup.bendGesture touchend.bendGesture", onUp);
    },
    [],
  );

  /**
   * Starts a click-or-drag wire gesture from a terminal.
   */
  const handleTerminalPointerDown = useCallback(
    (terminalId: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.evt.preventDefault();
      const maybeStage = e.target.getStage();
      if (!maybeStage) return;
      const stageNode: KonvaStage = maybeStage;
      const pointer = stageNode.getPointerPosition();
      if (!pointer) return;

      setSelectedWireId(null);
      setWireMenu(null);

      gestureRef.current = {
        from: terminalId,
        start: { x: pointer.x, y: pointer.y },
        dragging: false,
      };

      /**
       * Updates the rubber-band draft once the pointer has moved enough.
       */
      function onMove(evt: KonvaEventObject<MouseEvent | TouchEvent>) {
        evt.evt.preventDefault();
        const gesture = gestureRef.current;
        if (!gesture) return;
        const pos = stageNode.getPointerPosition();
        if (!pos) return;

        const dx = pos.x - gesture.start.x;
        const dy = pos.y - gesture.start.y;
        if (!gesture.dragging) {
          if (dx * dx + dy * dy < WIRE_DRAG_THRESHOLD * WIRE_DRAG_THRESHOLD) {
            return;
          }
          gesture.dragging = true;
        }

        const nextWorld = pointerToWorld(pos, viewRef.current);
        setDraft({ kind: "drag", from: gesture.from, pointer: nextWorld });
      }

      /**
       * Completes the gesture as either a drag-drop or a click selection.
       */
      function onUp() {
        stageNode.off(".wireGesture");
        const gesture = gestureRef.current;
        gestureRef.current = null;
        if (!gesture) return;

        const pos = stageNode.getPointerPosition();
        const hit = pos ? stageNode.getIntersection(pos) : null;
        const targetId = terminalIdFromNode(hit);

        if (gesture.dragging) {
          if (targetId && targetId !== gesture.from) {
            connectTerminals(gesture.from, targetId);
          }
          setDraft(null);
          return;
        }

        // Click: select pending, clear if same, or complete the wire.
        const current = draftRef.current;
        if (current?.kind === "pending") {
          if (current.from === gesture.from) {
            setDraft(null);
            return;
          }
          connectTerminals(current.from, gesture.from);
          setDraft(null);
          return;
        }

        setDraft({ kind: "pending", from: gesture.from });
      }

      stageNode.on("mousemove.wireGesture touchmove.wireGesture", onMove);
      stageNode.on("mouseup.wireGesture touchend.wireGesture", onUp);
    },
    [connectTerminals],
  );

  const appCtx = useMemo(
    () => ({
      wireMode,
      pendingTerminalId,
      onTerminalPointerDown: handleTerminalPointerDown,
    }),
    [wireMode, pendingTerminalId, handleTerminalPointerDown],
  );

  /**
   * Clears pending wire selection or selected wire when clicking empty stage space.
   */
  function handleStageClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target !== e.target.getStage()) return;
    if (suppressStageClickRef.current) {
      suppressStageClickRef.current = false;
      return;
    }
    if (draftRef.current?.kind === "pending") {
      setDraft(null);
    }
    clearWireSelection();
  }

  /**
   * Starts click-drag panning when the pointer goes down on empty canvas.
   */
  const handleStagePointerDown = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target !== e.target.getStage()) return;
      // Stop mobile browsers from scrolling the page while we pan the lab.
      e.evt.preventDefault();
      const maybeStage = e.target.getStage();
      if (!maybeStage) return;
      const stageNode: KonvaStage = maybeStage;
      const startPointer = stageNode.getPointerPosition();
      if (!startPointer) return;
      const origin = { x: startPointer.x, y: startPointer.y };

      const startView = viewRef.current;
      let panning = false;

      /**
       * Pans the view by the pointer delta (content follows the drag).
       */
      function onMove(evt: KonvaEventObject<MouseEvent | TouchEvent>) {
        evt.evt.preventDefault();
        const pos = stageNode.getPointerPosition();
        if (!pos) return;
        const dx = pos.x - origin.x;
        const dy = pos.y - origin.y;
        if (!panning) {
          if (dx * dx + dy * dy < PAN_DRAG_THRESHOLD * PAN_DRAG_THRESHOLD) {
            return;
          }
          panning = true;
          suppressStageClickRef.current = true;
          wrapRef.current?.classList.add("stage-wrap--panning");
          stageNode.container().style.cursor = "grabbing";
        }

        setView(
          clampView(
            {
              ...startView,
              x: startView.x + dx,
              y: startView.y + dy,
            },
            size,
            contentBoundsRef.current,
          ),
        );
      }

      /**
       * Ends the pan gesture.
       */
      function onUp() {
        stageNode.off(".stagePan");
        wrapRef.current?.classList.remove("stage-wrap--panning");
        stageNode.container().style.cursor = STAGE_DEFAULT_CURSOR;
      }

      stageNode.on("mousemove.stagePan touchmove.stagePan", onMove);
      stageNode.on("mouseup.stagePan touchend.stagePan", onUp);
    },
    [size],
  );

  /**
   * Clears button presses, wires, selection, and any in-progress draft.
   */
  function reset() {
    setPressed({ front: false, rear: false });
    setWires([]);
    clearWireSelection();
    setDraft(null);
    gestureRef.current = null;
  }

  // Keyboard: Escape clears selection/draft; Delete removes the selected wire.
  useEffect(() => {
    /**
     * Handles Escape / Delete / Backspace for wire selection.
     */
    function onKeyDown(evt: KeyboardEvent) {
      const target = evt.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (evt.key === "Escape") {
        setDraft(null);
        clearWireSelection();
        gestureRef.current = null;
        return;
      }

      if (
        (evt.key === "Delete" || evt.key === "Backspace") &&
        selectedWireId
      ) {
        evt.preventDefault();
        deleteWire(selectedWireId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearWireSelection, deleteWire, selectedWireId]);

  /**
   * Zooms toward the stage center by a fixed step.
   */
  function zoomBy(factor: number) {
    setView((prev) =>
      zoomAt(
        prev,
        { x: size.width / 2, y: size.height / 2 },
        prev.scale * factor,
        size,
        contentBoundsRef.current,
      ),
    );
  }

  /**
   * Resets stage scale and pan to the default view.
   */
  function resetView() {
    setView(clampView(INITIAL_VIEW, size, contentBoundsRef.current));
  }

  /**
   * Maps-style navigation: scroll pans; trackpad pinch (ctrl/meta+wheel) zooms.
   */
  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();

    let { deltaX, deltaY } = e.evt;
    // Normalize line/page deltas so mouse wheels and trackpads feel similar.
    if (e.evt.deltaMode === 1) {
      deltaX *= 16;
      deltaY *= 16;
    } else if (e.evt.deltaMode === 2) {
      deltaX *= size.width;
      deltaY *= size.height;
    }

    // Trackpad pinch (and ctrl/cmd+wheel) zooms toward the pointer.
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      setView((prev) => {
        const nextScale = prev.scale * Math.exp(-deltaY * PINCH_ZOOM_INTENSITY);
        return zoomAt(prev, pointer, nextScale, size, contentBoundsRef.current);
      });
      return;
    }

    setView((prev) =>
      clampView(
        {
          ...prev,
          x: prev.x - deltaX,
          y: prev.y - deltaY,
        },
        size,
        contentBoundsRef.current,
      ),
    );
  }

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Andy · React + Konva</h1>
        <p>{status}</p>
        <div className="toolbar-zoom" aria-label="Zoom controls">
          <button type="button" onClick={() => zoomBy(1 / BUTTON_SCALE_BY)}>
            −
          </button>
          <span>{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(BUTTON_SCALE_BY)}>
            +
          </button>
          <button type="button" onClick={resetView}>
            Reset view
          </button>
        </div>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </header>
      <div className="stage-wrap" ref={wrapRef}>
        {size.width > 0 && size.height > 0 ? (
          <AppCtxProvider value={appCtx}>
            <Stage
              ref={stageRef}
              width={size.width}
              height={size.height}
              scaleX={view.scale}
              scaleY={view.scale}
              x={view.x}
              y={view.y}
              onWheel={handleWheel}
              onMouseDown={handleStagePointerDown}
              onTouchStart={handleStagePointerDown}
              onMouseLeave={(e) => {
                setStageCursor(e, STAGE_DEFAULT_CURSOR);
              }}
              onClick={handleStageClick}
              onTap={handleStageClick}
            >
              <LabLayer
                pressed={pressed}
                positions={positions}
                wires={wires}
                selectedWireId={selectedWireId}
                draft={draft}
                onPressedChange={setButtonPressed}
                onModuleDragMove={handleModuleDragMove}
                onModuleDragEnd={handleModuleDragEnd}
                onWireSelect={handleWireSelect}
                onWireAddBend={handleWireAddBend}
                onBendMove={handleBendMove}
                onBendRemove={handleBendRemove}
                onMidpointPointerDown={handleMidpointPointerDown}
                onContentBoundsChange={syncContentBounds}
              />
            </Stage>
          </AppCtxProvider>
        ) : null}
        {wireMenu ? (
          <WireActionsMenu
            menu={wireMenu}
            screen={worldToPointer(wireMenu.world, view)}
            viewport={size}
            color={
              wires.find((w) => w.id === wireMenu.wireId)?.color ??
              DEFAULT_WIRE_COLOR
            }
            onDismiss={dismissWireMenu}
            onDelete={() => deleteWire(wireMenu.wireId)}
            onToggleColorPicker={() =>
              setWireMenu((prev) =>
                prev
                  ? { ...prev, colorPickerOpen: !prev.colorPickerOpen }
                  : prev,
              )
            }
            onPickColor={(color) => {
              setWireColor(wireMenu.wireId, color);
              setWireMenu((prev) =>
                prev ? { ...prev, colorPickerOpen: false } : prev,
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
