import { describe, expect, it } from "vitest";
import {
  findClosestSegmentIndex,
  wireSegmentMidpoints,
} from "../js/wire-path.js";

describe("wireSegmentMidpoints", () => {
  it("returns chord midpoints for a straight two-point wire", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(wireSegmentMidpoints(verts, 0.4)).toEqual([{ x: 5, y: 0 }]);
  });

  it("tracks the tensioned curve instead of the chord for bent wires", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const mids = wireSegmentMidpoints(verts, 0.4);
    expect(mids).toHaveLength(2);
    // First-segment chord mid is (25, 25); tension bulges toward the peak.
    expect(mids[0].y).toBeGreaterThan(25);
  });
});

describe("findClosestSegmentIndex", () => {
  it("picks the nearest chord segment for bend insertion", () => {
    const from = { x: 0, y: 0 };
    const bends = [{ x: 50, y: 0 }];
    const to = { x: 100, y: 0 };
    expect(findClosestSegmentIndex(from, bends, to, { x: 10, y: 5 })).toBe(0);
    expect(findClosestSegmentIndex(from, bends, to, { x: 80, y: 5 })).toBe(1);
  });
});
