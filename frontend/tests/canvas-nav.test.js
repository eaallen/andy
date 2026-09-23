import { describe, expect, it } from "vitest";
import {
  BUTTON_SCALE_BY,
  EDGE_MARGIN,
  INITIAL_VIEW,
  MAX_SCALE,
  MIN_SCALE,
  applyViewToStage,
  boundsFromClientRect,
  centerBetween,
  clampRange,
  clampScale,
  clampView,
  distanceBetween,
  easeOutCubic,
  lerpView,
  normalizeWheelDeltas,
  pinchZoomView,
  pointerToWorld,
  stagePointsFromTouches,
  viewFocusingOnBounds,
  worldToPointer,
  zoomAt,
} from "../js/canvas-nav.js";

const viewport = { width: 800, height: 600 };
const content = { minX: 0, minY: 0, maxX: 400, maxY: 300 };

describe("clampRange", () => {
  it("clamps into [min, max]", () => {
    expect(clampRange(5, 0, 10)).toBe(5);
    expect(clampRange(-1, 0, 10)).toBe(0);
    expect(clampRange(11, 0, 10)).toBe(10);
  });

  it("centers when the range is empty", () => {
    expect(clampRange(0, 10, 0)).toBe(5);
  });
});

describe("clampScale", () => {
  it("clamps between min and max zoom", () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(10)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe("clampView", () => {
  it("keeps EDGE_MARGIN of content visible", () => {
    const view = clampView(
      { scale: 1, x: -1000, y: -1000 },
      viewport,
      content
    );
    // maxX = viewport - EDGE_MARGIN - content.minX = 800 - 72 = 728
    // minX = EDGE_MARGIN - content.maxX = 72 - 400 = -328
    expect(view.x).toBe(-328);
    expect(view.y).toBe(EDGE_MARGIN - content.maxY);
  });

  it("returns the view unchanged for an empty viewport", () => {
    const view = { scale: 1.2, x: 10, y: 20 };
    expect(clampView(view, { width: 0, height: 600 }, content)).toEqual(view);
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the pointer stable", () => {
    const pointer = { x: 200, y: 150 };
    const before = pointerToWorld(pointer, INITIAL_VIEW);
    const next = zoomAt(
      INITIAL_VIEW,
      pointer,
      BUTTON_SCALE_BY,
      viewport,
      content
    );
    const after = pointerToWorld(pointer, next);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.scale).toBeCloseTo(BUTTON_SCALE_BY, 5);
  });

  it("clamps zoom to MAX_SCALE", () => {
    const next = zoomAt(
      INITIAL_VIEW,
      { x: 100, y: 100 },
      99,
      viewport,
      content
    );
    expect(next.scale).toBe(MAX_SCALE);
  });
});

describe("pointer / world conversion", () => {
  it("round-trips through pointerToWorld and worldToPointer", () => {
    const view = { scale: 2, x: 40, y: -20 };
    const world = { x: 50, y: 80 };
    expect(pointerToWorld(worldToPointer(world, view), view)).toEqual(world);
  });
});

describe("boundsFromClientRect", () => {
  it("converts a client rect into min/max bounds", () => {
    expect(boundsFromClientRect({ x: 10, y: 20, width: 100, height: 50 })).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    });
  });
});

describe("viewFocusingOnBounds", () => {
  it("pans to center the target without changing scale", () => {
    const target = { minX: 100, minY: 50, maxX: 300, maxY: 200 };
    const next = viewFocusingOnBounds(target, viewport, content, 1.25);
    expect(next.scale).toBe(1.25);
    const screenCenter = worldToPointer({ x: 200, y: 125 }, next);
    expect(screenCenter.x).toBeCloseTo(viewport.width / 2, 5);
    expect(screenCenter.y).toBeCloseTo(viewport.height / 2, 5);
  });

  it("preserves the current scale when centering a far-away target", () => {
    const target = { minX: 900, minY: 700, maxX: 1000, maxY: 800 };
    const wideContent = { minX: 0, minY: 0, maxX: 1200, maxY: 1000 };
    const next = viewFocusingOnBounds(target, viewport, wideContent, 0.8);
    expect(next.scale).toBe(0.8);
  });

  it("falls back to unit scale when scale is missing or invalid", () => {
    const target = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(viewFocusingOnBounds(target, viewport, content).scale).toBe(1);
    expect(viewFocusingOnBounds(target, viewport, content, 0).scale).toBe(1);
    expect(viewFocusingOnBounds(target, viewport, content, -2).scale).toBe(1);
  });

  it("returns the initial view for an empty viewport", () => {
    const target = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(
      viewFocusingOnBounds(target, { width: 0, height: 600 }, content, 1.5)
    ).toEqual(INITIAL_VIEW);
  });
});

describe("easeOutCubic and lerpView", () => {
  it("eases from 0 to 1 with a soft landing", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("clamps progress outside [0, 1]", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(
      lerpView({ scale: 1, x: 0, y: 0 }, { scale: 2, x: 10, y: 20 }, -1)
    ).toEqual({ scale: 1, x: 0, y: 0 });
    expect(
      lerpView({ scale: 1, x: 0, y: 0 }, { scale: 2, x: 10, y: 20 }, 2)
    ).toEqual({ scale: 2, x: 10, y: 20 });
  });

  it("interpolates scale and pan", () => {
    expect(
      lerpView({ scale: 1, x: 0, y: 0 }, { scale: 2, x: 100, y: -50 }, 0.5)
    ).toEqual({ scale: 1.5, x: 50, y: -25 });
  });
});

describe("normalizeWheelDeltas", () => {
  it("scales line-mode deltas", () => {
    expect(
      normalizeWheelDeltas({ deltaX: 1, deltaY: 2, deltaMode: 1 }, viewport)
    ).toEqual({ deltaX: 16, deltaY: 32 });
  });

  it("scales page-mode deltas against the viewport", () => {
    expect(
      normalizeWheelDeltas({ deltaX: 1, deltaY: 0.5, deltaMode: 2 }, viewport)
    ).toEqual({ deltaX: 800, deltaY: 300 });
  });

  it("leaves pixel-mode deltas unchanged", () => {
    expect(
      normalizeWheelDeltas({ deltaX: 3, deltaY: -4, deltaMode: 0 }, viewport)
    ).toEqual({ deltaX: 3, deltaY: -4 });
  });
});

describe("pinch helpers", () => {
  it("measures distance and midpoint between points", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(centerBetween({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({
      x: 5,
      y: 10,
    });
  });

  it("maps touches into stage-container coordinates", () => {
    expect(
      stagePointsFromTouches(
        [
          { clientX: 110, clientY: 220 },
          { clientX: 130, clientY: 240 },
        ],
        { left: 100, top: 200 }
      )
    ).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });

  it("zooms around the pinch midpoint and follows center motion", () => {
    const lastCenter = { x: 200, y: 150 };
    const newCenter = { x: 210, y: 160 };
    const before = pointerToWorld(newCenter, INITIAL_VIEW);
    const next = pinchZoomView(
      INITIAL_VIEW,
      lastCenter,
      100,
      newCenter,
      200,
      viewport,
      content
    );
    // Scale doubles; world point under newCenter stays put before the pan delta.
    expect(next.scale).toBeCloseTo(2, 5);
    const afterZoomOnly = zoomAt(INITIAL_VIEW, newCenter, 2, viewport, content);
    expect(next.x).toBeCloseTo(afterZoomOnly.x + 10, 5);
    expect(next.y).toBeCloseTo(afterZoomOnly.y + 10, 5);
    // Sanity: zooming alone would keep before under newCenter; pan then shifts view.
    const after = pointerToWorld(newCenter, next);
    expect(after.x).toBeCloseTo(before.x - 10 / next.scale, 5);
    expect(after.y).toBeCloseTo(before.y - 10 / next.scale, 5);
  });

  it("returns the view unchanged for a zero distance frame", () => {
    const view = { scale: 1.2, x: 5, y: 6 };
    expect(
      pinchZoomView(
        view,
        { x: 0, y: 0 },
        0,
        { x: 10, y: 10 },
        50,
        viewport,
        content
      )
    ).toEqual(view);
  });
});

describe("applyViewToStage", () => {
  it("sets scale and position on the stage", () => {
    const calls = [];
    const stage = {
      scale: function (value) {
        calls.push(["scale", value]);
      },
      position: function (value) {
        calls.push(["position", value]);
      },
    };
    applyViewToStage(stage, { scale: 1.5, x: 12, y: 34 });
    expect(calls).toEqual([
      ["scale", { x: 1.5, y: 1.5 }],
      ["position", { x: 12, y: 34 }],
    ]);
  });
});
