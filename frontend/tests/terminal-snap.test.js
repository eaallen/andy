import { describe, expect, it } from "vitest";
import {
  TERMINAL_SNAP_SCREEN_RADIUS,
  WIRE_DRAG_THRESHOLD,
  WIRE_DRAG_THRESHOLD_TOUCH,
  nearestTerminalInScreenRadius,
  wireDragThresholdForEvent,
} from "../js/terminal-snap.js";

describe("nearestTerminalInScreenRadius", () => {
  const view = { scale: 1, x: 0, y: 0 };

  /**
   * Builds a fake terminal with a stable id for exclude checks.
   * @param {string} id - Terminal id.
   * @param {number} x - World x.
   * @param {number} y - World y.
   */
  function term(id, x, y) {
    return { id: id, world: { x: x, y: y } };
  }

  /**
   * @param {object} terminal - Fake terminal from term().
   */
  function getWorldPos(terminal) {
    return terminal.world;
  }

  it("returns the nearest terminal within the screen radius", () => {
    const a = term("a", 100, 100);
    const b = term("b", 200, 100);
    const hit = nearestTerminalInScreenRadius(
      { x: 110, y: 100 },
      [a, b],
      getWorldPos,
      view,
      TERMINAL_SNAP_SCREEN_RADIUS
    );
    expect(hit).toBe(a);
  });

  it("returns null when pointer is outside the radius", () => {
    const a = term("a", 0, 0);
    const hit = nearestTerminalInScreenRadius(
      { x: TERMINAL_SNAP_SCREEN_RADIUS + 1, y: 0 },
      [a],
      getWorldPos,
      view,
      TERMINAL_SNAP_SCREEN_RADIUS
    );
    expect(hit).toBeNull();
  });

  it("respects the exclude predicate (drag source)", () => {
    const from = term("from", 100, 100);
    const to = term("to", 120, 100);
    const hit = nearestTerminalInScreenRadius(
      { x: 110, y: 100 },
      [from, to],
      getWorldPos,
      view,
      TERMINAL_SNAP_SCREEN_RADIUS,
      function (terminal) {
        return terminal.id === "from";
      }
    );
    expect(hit).toBe(to);
  });

  it("uses screen space so zoom-out still snaps within radiusPx", () => {
    const zoomedOut = { scale: 0.5, x: 0, y: 0 };
    const a = term("a", 100, 100);
    // World delta 50 → screen delta 25 at scale 0.5 (within 36px).
    const hit = nearestTerminalInScreenRadius(
      { x: 75, y: 50 },
      [a],
      getWorldPos,
      zoomedOut,
      TERMINAL_SNAP_SCREEN_RADIUS
    );
    expect(hit).toBe(a);
  });

  it("returns null when exclude removes the only candidate", () => {
    const only = term("only", 10, 10);
    const hit = nearestTerminalInScreenRadius(
      { x: 10, y: 10 },
      [only],
      getWorldPos,
      view,
      TERMINAL_SNAP_SCREEN_RADIUS,
      function () {
        return true;
      }
    );
    expect(hit).toBeNull();
  });
});

describe("wireDragThresholdForEvent", () => {
  it("uses the mouse threshold for mouse events", () => {
    expect(wireDragThresholdForEvent({ evt: { type: "mousedown" } })).toBe(
      WIRE_DRAG_THRESHOLD
    );
    expect(wireDragThresholdForEvent({ type: "mousemove" })).toBe(WIRE_DRAG_THRESHOLD);
  });

  it("uses the larger touch threshold for touch events", () => {
    expect(wireDragThresholdForEvent({ evt: { type: "touchstart" } })).toBe(
      WIRE_DRAG_THRESHOLD_TOUCH
    );
    expect(wireDragThresholdForEvent({ type: "touchmove" })).toBe(
      WIRE_DRAG_THRESHOLD_TOUCH
    );
  });

  it("defaults to the mouse threshold when type is missing", () => {
    expect(wireDragThresholdForEvent(null)).toBe(WIRE_DRAG_THRESHOLD);
    expect(wireDragThresholdForEvent({})).toBe(WIRE_DRAG_THRESHOLD);
  });
});
