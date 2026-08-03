import { worldToPointer } from "./canvas-nav.js";

/** Max screen distance (px) for magnetic terminal snap on wire connect. */
export const TERMINAL_SNAP_SCREEN_RADIUS = 36;
/** Pointer travel (stage px) before a mouse press becomes a wire drag. */
export const WIRE_DRAG_THRESHOLD = 6;
/** Pointer travel (stage px) before a touch press becomes a wire drag. */
export const WIRE_DRAG_THRESHOLD_TOUCH = 12;

/**
 * Returns the drag threshold for a Konva or native pointer event.
 * Touch uses a larger threshold so fat-finger taps stay taps.
 * @param {Konva.KonvaEventObject|Event|null|undefined} evt - Gesture event.
 */
export function wireDragThresholdForEvent(evt) {
  return isTouchPointerEvent(evt) ? WIRE_DRAG_THRESHOLD_TOUCH : WIRE_DRAG_THRESHOLD;
}

/**
 * Returns whether a Konva or native event came from a touch pointer.
 * @param {Konva.KonvaEventObject|Event|null|undefined} evt - Gesture event.
 */
export function isTouchPointerEvent(evt) {
  const native = evt && evt.evt ? evt.evt : evt;
  const type = native && typeof native.type === "string" ? native.type : "";
  return type.indexOf("touch") === 0;
}

/**
 * Finds the nearest terminal within a screen-pixel radius of a stage pointer.
 * @param {{ x: number; y: number }} pointer - Stage-container pointer position.
 * @param {Array<object>} terminals - Terminal metadata objects to search.
 * @param {(terminal: object) => { x: number; y: number }} getWorldPos - World position of each terminal.
 * @param {{ scale: number; x: number; y: number }} view - Current camera.
 * @param {number} radiusPx - Max screen distance in pixels.
 * @param {(terminal: object) => boolean} [exclude] - Optional predicate; true skips the terminal.
 */
export function nearestTerminalInScreenRadius(
  pointer,
  terminals,
  getWorldPos,
  view,
  radiusPx,
  exclude
) {
  if (!pointer || !terminals || !view || !(radiusPx > 0)) {
    return null;
  }

  let best = null;
  let bestDistSq = radiusPx * radiusPx;

  for (let i = 0; i < terminals.length; i += 1) {
    const terminal = terminals[i];
    if (!terminal) {
      continue;
    }
    if (typeof exclude === "function" && exclude(terminal)) {
      continue;
    }
    const world = getWorldPos(terminal);
    if (!world) {
      continue;
    }
    const screen = worldToPointer(world, view);
    const dx = screen.x - pointer.x;
    const dy = screen.y - pointer.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      best = terminal;
    }
  }

  return best;
}
