import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL_VIEW } from "../js/canvas-nav.js";
import { createStageCamera } from "../js/stage-camera.js";

/**
 * Builds a fake Konva-like stage for camera tests.
 * @param {{ width?: number, height?: number }} [size] - Stage size.
 */
function makeStage(size) {
  const width = size && size.width != null ? size.width : 800;
  const height = size && size.height != null ? size.height : 600;
  /** @type {{ scale: { x: number, y: number }, position: { x: number, y: number }, draws: number }} */
  const state = {
    scale: { x: 1, y: 1 },
    position: { x: 0, y: 0 },
    draws: 0,
  };
  return {
    state: state,
    width: function () {
      return width;
    },
    height: function () {
      return height;
    },
    scale: function (value) {
      state.scale = value;
    },
    position: function (value) {
      state.position = value;
    },
    batchDraw: function () {
      state.draws += 1;
    },
  };
}

describe("createStageCamera", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("setView applies scale/position and notifies onViewChange", () => {
    const stage = makeStage();
    const changes = [];
    const camera = createStageCamera({
      stage: stage,
      onViewChange: function (view) {
        changes.push({ ...view });
      },
    });

    camera.setView({ scale: 1.5, x: 10, y: 20 });

    expect(camera.getView().scale).toBe(1.5);
    expect(stage.state.scale).toEqual({ x: 1.5, y: 1.5 });
    expect(stage.state.position).toEqual({ x: 10, y: 20 });
    expect(changes).toEqual([{ scale: 1.5, x: 10, y: 20 }]);
    expect(stage.state.draws).toBe(1);
  });

  it("focusNode pans to the node center without changing zoom", () => {
    vi.useFakeTimers();
    const stage = makeStage();
    const camera = createStageCamera({ stage: stage });
    camera.setContentBounds({ minX: 0, minY: 0, maxX: 1000, maxY: 800 });
    camera.setView({ scale: 1.25, x: 0, y: 0 });

    const node = {
      getClientRect: function () {
        return { x: 100, y: 50, width: 200, height: 150 };
      },
    };

    let completed = 0;
    camera.focusNode(node, function () {
      completed += 1;
    });

    expect(camera.getView().scale).toBe(1.25);
    expect(completed).toBe(0);

    vi.advanceTimersByTime(500);
    vi.runOnlyPendingTimers();

    expect(completed).toBe(1);
    expect(camera.getView().scale).toBe(1.25);
    // Target center (200, 125) should land at viewport center.
    expect(camera.getView().x).toBeCloseTo(800 / 2 - 200 * 1.25, 5);
    expect(camera.getView().y).toBeCloseTo(600 / 2 - 125 * 1.25, 5);
  });

  it("calls onComplete after animateTo finishes", () => {
    vi.useFakeTimers();
    const stage = makeStage();
    const camera = createStageCamera({ stage: stage });
    camera.setContentBounds({ minX: 0, minY: 0, maxX: 1000, maxY: 800 });

    let completed = 0;
    camera.animateTo({ scale: 1, x: -100, y: -50 }, function () {
      completed += 1;
    });

    vi.advanceTimersByTime(500);
    // Flush rAF callbacks scheduled against fake timers.
    vi.runOnlyPendingTimers();

    expect(completed).toBe(1);
    expect(camera.getView().x).toBeCloseTo(-100, 0);
    expect(camera.getView().y).toBeCloseTo(-50, 0);
  });

  it("focusNode with a missing node completes immediately", () => {
    const camera = createStageCamera({ stage: makeStage() });
    let completed = 0;
    camera.focusNode(null, function () {
      completed += 1;
    });
    expect(completed).toBe(1);
  });

  it("focusNode with an empty rect completes immediately", () => {
    const camera = createStageCamera({ stage: makeStage() });
    let completed = 0;
    camera.focusNode(
      {
        getClientRect: function () {
          return { x: 10, y: 10, width: 0, height: 0 };
        },
      },
      function () {
        completed += 1;
      },
    );
    expect(completed).toBe(1);
  });

  it("setView cancels an in-flight animation so onComplete does not fire", () => {
    vi.useFakeTimers();
    const camera = createStageCamera({ stage: makeStage() });
    let completed = 0;
    camera.animateTo({ scale: 1, x: -40, y: -20 }, function () {
      completed += 1;
    });
    camera.setView(INITIAL_VIEW);
    vi.advanceTimersByTime(1000);
    vi.runOnlyPendingTimers();
    expect(completed).toBe(0);
    expect(camera.getView()).toEqual(INITIAL_VIEW);
  });

  it("zoomBy scales around the viewport center", () => {
    const camera = createStageCamera({ stage: makeStage() });
    camera.setContentBounds({ minX: 0, minY: 0, maxX: 400, maxY: 300 });
    camera.zoomBy(1.2);
    expect(camera.getView().scale).toBeCloseTo(1.2, 5);
  });

  it("resetView restores the default camera", () => {
    const camera = createStageCamera({ stage: makeStage() });
    camera.setView({ scale: 2, x: -50, y: -30 });
    camera.resetView();
    expect(camera.getView()).toEqual(INITIAL_VIEW);
  });

  it("setContentBounds updates pan clamping limits", () => {
    const camera = createStageCamera({ stage: makeStage() });
    const bounds = { minX: 10, minY: 20, maxX: 400, maxY: 300 };
    camera.setContentBounds(bounds);
    expect(camera.getContentBounds()).toEqual(bounds);
    expect(camera.viewportSize()).toEqual({ width: 800, height: 600 });
  });
});
