import { describe, expect, it } from "vitest";
import type { Point } from "../src/comps/terminals";
import {
  findWireJumpSites,
  segmentIntersection,
  wirePointsWithJumps,
  WIRE_JUMP_RADIUS,
} from "../src/comps/wirePath";

describe("segmentIntersection", () => {
  it("finds a proper crossing", () => {
    const hit = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );
    expect(hit).toEqual({ x: 5, y: 5 });
  });

  it("returns null for parallel segments", () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 2 },
        { x: 10, y: 2 },
      ),
    ).toBeNull();
  });

  it("returns null when segments only share an endpoint", () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ),
    ).toBeNull();
  });
});

describe("findWireJumpSites", () => {
  it("puts a jump on the later (over) wire at a crossing", () => {
    const under = {
      id: "under",
      verts: [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ] satisfies Point[],
    };
    const over = {
      id: "over",
      verts: [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ] satisfies Point[],
    };

    const jumps = findWireJumpSites([under, over], 0);
    expect(jumps.has("under")).toBe(false);
    const overJumps = jumps.get("over");
    expect(overJumps).toHaveLength(1);
    expect(overJumps![0].x).toBeCloseTo(50, 0);
    expect(overJumps![0].y).toBeCloseTo(50, 0);
  });

  it("does not jump when wires only meet at an endpoint", () => {
    const a = {
      id: "a",
      verts: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ] satisfies Point[],
    };
    const b = {
      id: "b",
      verts: [
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ] satisfies Point[],
    };
    expect(findWireJumpSites([a, b], 0).size).toBe(0);
  });
});

describe("wirePointsWithJumps", () => {
  it("inserts an arc that bulges away from the under path", () => {
    const verts: Point[] = [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const jumps = findWireJumpSites(
      [
        {
          id: "under",
          verts: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
        },
        { id: "over", verts },
      ],
      0,
    ).get("over")!;

    const points = wirePointsWithJumps(verts, 0, jumps, WIRE_JUMP_RADIUS);
    expect(points.length).toBeGreaterThan(4);

    // Arc should peak to the left of downward travel (left normal = -x).
    let minX = Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
    }
    expect(minX).toBeLessThan(50 - WIRE_JUMP_RADIUS * 0.8);
  });

  it("returns a plain polyline when there are no jumps", () => {
    const verts: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ];
    const points = wirePointsWithJumps(verts, 0, []);
    expect(points[0]).toBe(0);
    expect(points[1]).toBe(0);
    expect(points[points.length - 2]).toBe(20);
    expect(points[points.length - 1]).toBe(0);
  });
});
