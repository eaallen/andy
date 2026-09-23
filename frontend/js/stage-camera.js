import {
  FOCUS_ANIM_MS,
  INITIAL_VIEW,
  applyViewToStage,
  boundsFromClientRect,
  clampView,
  easeOutCubic,
  lerpView,
  viewFocusingOnBounds,
  zoomAt,
} from "./canvas-nav.js";

/**
 * Owns stage pan/zoom state, clamping, and animated focus moves.
 * @param {{
 *   stage: {
 *     width: () => number,
 *     height: () => number,
 *     scale: (value: { x: number, y: number }) => void,
 *     position: (value: { x: number, y: number }) => void,
 *     batchDraw: () => void,
 *   },
 *   onViewChange?: (view: { scale: number, x: number, y: number }) => void,
 * }} options - Stage and optional view-change hook (zoom label, menus).
 */
export function createStageCamera(options) {
  const stage = options.stage;
  const onViewChange = options.onViewChange;

  /** @type {{ scale: number, x: number, y: number }} */
  let view = {
    scale: INITIAL_VIEW.scale,
    x: INITIAL_VIEW.x,
    y: INITIAL_VIEW.y,
  };
  /** @type {{ minX: number, minY: number, maxX: number, maxY: number }} */
  let contentBounds = {
    minX: 0,
    minY: 0,
    maxX: stage.width(),
    maxY: stage.height(),
  };
  /** @type {number|null} */
  let animFrame = null;

  /**
   * Returns the current stage pixel size.
   */
  function viewportSize() {
    return { width: stage.width(), height: stage.height() };
  }

  /**
   * Returns the live camera state (mutated in place by setView/animateTo).
   */
  function getView() {
    return view;
  }

  /**
   * Returns the current content AABB used for pan clamping.
   */
  function getContentBounds() {
    return contentBounds;
  }

  /**
   * Replaces the content AABB used for pan clamping.
   * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds - World-space content box.
   */
  function setContentBounds(bounds) {
    contentBounds = bounds;
  }

  /**
   * Cancels an in-flight camera animation without applying a final frame.
   */
  function cancelAnimation() {
    if (animFrame == null) {
      return;
    }
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }

  /**
   * Applies a camera view without cancelling an in-flight animation.
   * @param {{ scale: number, x: number, y: number }} next - Camera to apply.
   */
  function applyView(next) {
    view = clampView(next, viewportSize(), contentBounds);
    applyViewToStage(stage, view);
    if (typeof onViewChange === "function") {
      onViewChange(view);
    }
    stage.batchDraw();
  }

  /**
   * Applies a camera view immediately, cancelling any focus animation.
   * @param {{ scale: number, x: number, y: number }} next - Camera to apply.
   */
  function setView(next) {
    cancelAnimation();
    applyView(next);
  }

  /**
   * Smoothly animates the camera from the current view to `next`.
   * @param {{ scale: number, x: number, y: number }} next - Target camera.
   * @param {(() => void)|undefined} [onComplete] - Called when the animation finishes.
   */
  function animateTo(next, onComplete) {
    cancelAnimation();
    const from = { scale: view.scale, x: view.x, y: view.y };
    const to = clampView(next, viewportSize(), contentBounds);
    const started = performance.now();

    /**
     * Advances one animation frame toward the target camera.
     * @param {number} now - requestAnimationFrame timestamp.
     */
    function frame(now) {
      const t = Math.min(1, (now - started) / FOCUS_ANIM_MS);
      applyView(lerpView(from, to, easeOutCubic(t)));
      if (t < 1) {
        animFrame = requestAnimationFrame(frame);
        return;
      }
      animFrame = null;
      if (typeof onComplete === "function") {
        onComplete();
      }
    }

    animFrame = requestAnimationFrame(frame);
  }

  /**
   * Pans to center a Konva node at the current zoom.
   * Optionally runs onComplete when the pan animation finishes.
   * @param {{ getClientRect?: Function }|null|undefined} node - Component or terminal node.
   * @param {(() => void)|undefined} [onComplete] - Called after the pan finishes.
   */
  function focusNode(node, onComplete) {
    if (!node || typeof node.getClientRect !== "function") {
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }
    const rect = node.getClientRect({
      relativeTo: stage,
      skipShadow: true,
    });
    if (!(rect.width > 0) || !(rect.height > 0)) {
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }
    animateTo(
      viewFocusingOnBounds(
        boundsFromClientRect(rect),
        viewportSize(),
        contentBounds,
        view.scale,
      ),
      onComplete,
    );
  }

  /**
   * Zooms toward the stage center by a fixed step.
   * @param {number} factor - Multiplier applied to the current scale.
   */
  function zoomBy(factor) {
    const size = viewportSize();
    setView(
      zoomAt(
        view,
        { x: size.width / 2, y: size.height / 2 },
        view.scale * factor,
        size,
        contentBounds,
      ),
    );
  }

  /**
   * Resets stage scale and pan to the default view.
   */
  function resetView() {
    setView(INITIAL_VIEW);
  }

  return {
    getView: getView,
    getContentBounds: getContentBounds,
    setContentBounds: setContentBounds,
    viewportSize: viewportSize,
    setView: setView,
    animateTo: animateTo,
    focusNode: focusNode,
    zoomBy: zoomBy,
    resetView: resetView,
    cancelAnimation: cancelAnimation,
  };
}
