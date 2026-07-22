import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Layer, Line, Stage } from "react-konva";
import { AppCtxProvider } from "./appCtx";
import { DoorbellButton, DOORBELL_SIZE } from "./comps/DoorbellButton";
import { Switch, SWITCH_SIZE } from "./comps/Switch";
import { Module } from "./comps/Module";
import {
  DEFAULT_TERMINALS,
  listTerminals,
  parseTerminalKey,
  wirePairKey,
  worldTerminalPos,
  type Point,
  type TerminalCounts,
} from "./comps/terminals";

const MIN_SCALE = 0.7;
const MAX_SCALE = 3;
const BUTTON_SCALE_BY = 1.2;
/** Pinch / ctrl+wheel sensitivity (higher = faster zoom). */
const PINCH_ZOOM_INTENSITY = 0.01;
/** How many pixels of content must stay on-screen at each edge. */
const EDGE_MARGIN = 72;
/** Pointer travel (stage px) before a terminal press counts as a wire drag. */
const WIRE_DRAG_THRESHOLD = 6;

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
};

type WireDraft =
  | { kind: "pending"; from: string }
  | { kind: "drag"; from: string; pointer: Point };

type WireGesture = {
  from: string;
  start: Point;
  dragging: boolean;
};

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

type LabLayerProps = {
  pressed: PressedState;
  positions: Record<ModuleId, Point>;
  wires: Wire[];
  selectedWireId: string | null;
  draft: WireDraft | null;
  onPressedChange: (id: ButtonId, pressed: boolean) => void;
  onModuleDragMove: (id: string, x: number, y: number) => void;
  onModuleDragEnd: (id: string, x: number, y: number) => void;
  onWireSelect: (id: string) => void;
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
  onContentBoundsChange,
}: LabLayerProps) {
  const wirePoints = wires
    .map((wire) => {
      const from = resolveTerminalWorldPos(wire.from, positions);
      const to = resolveTerminalWorldPos(wire.to, positions);
      if (!from || !to) return null;
      return { id: wire.id, points: [from.x, from.y, to.x, to.y] };
    })
    .filter((w): w is { id: string; points: number[] } => w !== null);

  const draftFrom =
    draft !== null ? resolveTerminalWorldPos(draft.from, positions) : null;
  const draftPoints =
    draft?.kind === "drag" && draftFrom
      ? [draftFrom.x, draftFrom.y, draft.pointer.x, draft.pointer.y]
      : null;

  return (
    <Layer onDragEnd={onContentBoundsChange}>
      {wirePoints.map((wire) => {
        const selected = wire.id === selectedWireId;
        return (
          <Line
            key={wire.id}
            name={`wire-${wire.id}`}
            points={wire.points}
            stroke={selected ? "#2563eb" : "#334155"}
            strokeWidth={selected ? 5 : 3}
            hitStrokeWidth={16}
            lineCap="round"
            lineJoin="round"
            onClick={(e) => {
              e.cancelBubble = true;
              onWireSelect(wire.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onWireSelect(wire.id);
            }}
          />
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
  const [draft, setDraft] = useState<WireDraft | null>(null);

  contentBoundsRef.current = contentBounds;
  viewRef.current = view;
  draftRef.current = draft;

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
      return "Wire selected — Delete to remove, Esc to deselect";
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
   * Adds a wire between two terminals when the pair is valid and new.
   */
  const connectTerminals = useCallback((from: string, to: string) => {
    if (from === to) return;
    setSelectedWireId(null);
    setWires((prev) => {
      if (hasWireBetween(prev, from, to)) return prev;
      return [
        ...prev,
        {
          id: `wire-${from}-${to}-${prev.length}`,
          from,
          to,
        },
      ];
    });
  }, []);

  /**
   * Selects a wire and clears any in-progress draft.
   */
  const handleWireSelect = useCallback((id: string) => {
    setDraft(null);
    gestureRef.current = null;
    setSelectedWireId(id);
  }, []);

  /**
   * Starts a click-or-drag wire gesture from a terminal.
   */
  const handleTerminalPointerDown = useCallback(
    (terminalId: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const maybeStage = e.target.getStage();
      if (!maybeStage) return;
      const stageNode: KonvaStage = maybeStage;
      const pointer = stageNode.getPointerPosition();
      if (!pointer) return;

      setSelectedWireId(null);

      gestureRef.current = {
        from: terminalId,
        start: { x: pointer.x, y: pointer.y },
        dragging: false,
      };

      /**
       * Updates the rubber-band draft once the pointer has moved enough.
       */
      function onMove() {
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
    if (draftRef.current?.kind === "pending") {
      setDraft(null);
    }
    setSelectedWireId(null);
  }

  /**
   * Clears button presses, wires, selection, and any in-progress draft.
   */
  function reset() {
    setPressed({ front: false, rear: false });
    setWires([]);
    setSelectedWireId(null);
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
        setSelectedWireId(null);
        gestureRef.current = null;
        return;
      }

      if (
        (evt.key === "Delete" || evt.key === "Backspace") &&
        selectedWireId
      ) {
        evt.preventDefault();
        setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
        setSelectedWireId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedWireId]);

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
                onContentBoundsChange={syncContentBounds}
              />
            </Stage>
          </AppCtxProvider>
        ) : null}
      </div>
    </div>
  );
}
