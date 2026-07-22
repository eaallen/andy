/** Minimum stage zoom (5%). */
export const MIN_SCALE = 0.05;
/** Maximum stage zoom (300%). */
export const MAX_SCALE = 3;
/** Toolbar +/- zoom step factor. */
export const BUTTON_SCALE_BY = 1.2;
/** Pinch / ctrl+wheel sensitivity (higher = faster zoom). */
export const PINCH_ZOOM_INTENSITY = 0.01;
/** How many pixels of content must stay on-screen at each edge. */
export const EDGE_MARGIN = 72;
/** Pointer travel (stage px) before an empty-canvas press counts as a pan. */
export const PAN_DRAG_THRESHOLD = 4;
/** Default cursor for empty canvas (maps-style grab-to-pan). */
export const STAGE_DEFAULT_CURSOR = "grab";

/** @typedef {{ scale: number; x: number; y: number }} ViewState */
/** @typedef {{ width: number; height: number }} StageSize */
/** @typedef {{ minX: number; minY: number; maxX: number; maxY: number }} ContentBounds */
/** @typedef {{ x: number; y: number }} Point */

/** Default camera before any pan/zoom. */
export const INITIAL_VIEW = /** @type {ViewState} */ ({ scale: 1, x: 0, y: 0 });

/**
 * Clamps a number into [min, max], centering when the range is empty.
 * @param {number} value - Value to clamp.
 * @param {number} min - Inclusive lower bound.
 * @param {number} max - Inclusive upper bound.
 */
export function clampRange(value, min, max) {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps stage scale between zoom limits.
 * @param {number} scale - Proposed scale.
 */
export function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Keeps content from panning completely off-screen.
 * Leaves EDGE_MARGIN pixels of the content box visible at the limit.
 * @param {ViewState} view - Current camera.
 * @param {StageSize} viewport - Stage pixel size.
 * @param {ContentBounds} content - World-space content AABB.
 */
export function clampView(view, viewport, content) {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return view;
  }

  const scale = view.scale;
  const minX = EDGE_MARGIN - content.maxX * scale;
  const maxX = viewport.width - EDGE_MARGIN - content.minX * scale;
  const minY = EDGE_MARGIN - content.maxY * scale;
  const maxY = viewport.height - EDGE_MARGIN - content.minY * scale;

  return {
    scale: scale,
    x: clampRange(view.x, minX, maxX),
    y: clampRange(view.y, minY, maxY),
  };
}

/**
 * Converts a Konva client rect into world-space content bounds.
 * @param {{ x: number; y: number; width: number; height: number }} rect - Client rect.
 */
export function boundsFromClientRect(rect) {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };
}

/**
 * Zooms the stage around a pointer so that point stays under the cursor.
 * @param {ViewState} view - Current camera.
 * @param {Point} pointer - Stage-container pointer position.
 * @param {number} nextScale - Proposed scale (will be clamped).
 * @param {StageSize} viewport - Stage pixel size.
 * @param {ContentBounds} content - World-space content AABB.
 */
export function zoomAt(view, pointer, nextScale, viewport, content) {
  const scale = clampScale(nextScale);
  const pointTo = {
    x: (pointer.x - view.x) / view.scale,
    y: (pointer.y - view.y) / view.scale,
  };
  return clampView(
    {
      scale: scale,
      x: pointer.x - pointTo.x * scale,
      y: pointer.y - pointTo.y * scale,
    },
    viewport,
    content
  );
}

/**
 * Converts a stage pointer into world (layer) coordinates.
 * @param {Point} pointer - Stage-container pointer position.
 * @param {ViewState} view - Current camera.
 */
export function pointerToWorld(pointer, view) {
  return {
    x: (pointer.x - view.x) / view.scale,
    y: (pointer.y - view.y) / view.scale,
  };
}

/**
 * Projects a world point into stage-container pixel coordinates.
 * @param {Point} world - World-space point.
 * @param {ViewState} view - Current camera.
 */
export function worldToPointer(world, view) {
  return {
    x: world.x * view.scale + view.x,
    y: world.y * view.scale + view.y,
  };
}

/**
 * Normalizes wheel deltas so mouse wheels and trackpads feel similar.
 * @param {{ deltaX: number; deltaY: number; deltaMode: number }} evt - Wheel event fields.
 * @param {StageSize} viewport - Stage pixel size (for page-mode deltas).
 */
export function normalizeWheelDeltas(evt, viewport) {
  let deltaX = evt.deltaX;
  let deltaY = evt.deltaY;
  if (evt.deltaMode === 1) {
    deltaX *= 16;
    deltaY *= 16;
  } else if (evt.deltaMode === 2) {
    deltaX *= viewport.width;
    deltaY *= viewport.height;
  }
  return { deltaX: deltaX, deltaY: deltaY };
}

/**
 * Applies a camera view to a Konva stage (scale + position).
 * @param {{ scale: Function; position: Function }} stage - Konva stage.
 * @param {ViewState} view - Camera to apply.
 */
export function applyViewToStage(stage, view) {
  stage.scale({ x: view.scale, y: view.scale });
  stage.position({ x: view.x, y: view.y });
}
