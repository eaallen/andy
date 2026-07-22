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
  normalizeWheelDeltas,
  pinchZoomView,
  pointerToWorld,
  stagePointsFromTouches,
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
