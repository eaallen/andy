import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Layer, Stage } from "react-konva";
import { DoorbellButton } from "./comps/DoorbellButton";
import { Switch } from "./comps/Switch";
import { Module } from "./comps/Module";

const MIN_SCALE = 0.7;
const MAX_SCALE = 3;
const BUTTON_SCALE_BY = 1.2;
/** Pinch / ctrl+wheel sensitivity (higher = faster zoom). */
const PINCH_ZOOM_INTENSITY = 0.01;
/** How many pixels of content must stay on-screen at each edge. */
const EDGE_MARGIN = 72;

type ButtonId = "front" | "rear";

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

type LabLayerProps = {
  pressed: PressedState;
  onPressedChange: (id: ButtonId, pressed: boolean) => void;
  onContentBoundsChange: () => void;
};

/**
 * Circuit shapes live here so pan/zoom view updates on App do not
 * re-reconcile every module — only Stage transform props change.
 */
const LabLayer = memo(function LabLayer({
  pressed,
  onPressedChange,
  onContentBoundsChange,
}: LabLayerProps) {
  return (
    <Layer onDragEnd={onContentBoundsChange}>
      <DoorbellButton
        id="front"
        x={120}
        y={160}
        title="Front"
        pressed={pressed.front}
        onPressedChange={onPressedChange}
      />
      <DoorbellButton
        id="rear"
        x={420}
        y={160}
        title="Rear"
        pressed={pressed.rear}
        onPressedChange={onPressedChange}
      />
      <Switch />
      <Module width={100} height={100} title="Switch" />
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
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });
  const [pressed, setPressed] = useState<PressedState>({
    front: false,
    rear: false,
  });
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [contentBounds, setContentBounds] = useState<ContentBounds>(
    INITIAL_CONTENT_BOUNDS,
  );

  contentBoundsRef.current = contentBounds;

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
    const active = Object.entries(pressed)
      .filter(([, isDown]) => isDown)
      .map(([id]) => id);
    if (active.length === 0) return "Idle — click a button";
    return `Pressed: ${active.join(", ")}`;
  }, [pressed]);

  /**
   * Updates one button's pressed flag.
   * Stable identity so memoized LabLayer can skip pan/zoom re-renders.
   */
  const setButtonPressed = useCallback((id: ButtonId, isDown: boolean) => {
    setPressed((prev) => ({ ...prev, [id]: isDown }));
  }, []);

  /**
   * Clears all button pressed state.
   */
  function reset() {
    setPressed({ front: false, rear: false });
  }

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
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            scaleX={view.scale}
            scaleY={view.scale}
            x={view.x}
            y={view.y}
            onWheel={handleWheel}
          >
            <LabLayer
              pressed={pressed}
              onPressedChange={setButtonPressed}
              onContentBoundsChange={syncContentBounds}
            />
          </Stage>
        ) : null}
      </div>
    </div>
  );
}
