import { describe, expect, it } from "vitest";
import {
  areConnected,
  buildAdjacency,
  reachableFrom,
  type ContinuityGate,
  type WireEdge,
} from "../src/circuit/graph";

describe("buildAdjacency", () => {
  it("links both directions for each edge", () => {
    const adj = buildAdjacency([{ from: "a", to: "b" }]);
    expect(adj.get("a")).toEqual(["b"]);
    expect(adj.get("b")).toEqual(["a"]);
  });

  it("ignores self-edges", () => {
    const adj = buildAdjacency([{ from: "a", to: "a" }]);
    expect(adj.size).toBe(0);
  });
});

describe("areConnected / reachableFrom", () => {
  it("connects A–C through two wires in series", () => {
    const edges: WireEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    const adj = buildAdjacency(edges);
    expect(areConnected(adj, "A", "C")).toBe(true);
    expect(reachableFrom(adj, "A")).toEqual(new Set(["A", "B", "C"]));
  });

  it("does not connect A–C when the middle link is missing", () => {
    const adj = buildAdjacency([{ from: "A", to: "B" }]);
    expect(areConnected(adj, "A", "C")).toBe(false);
  });

  it("treats a terminal as connected to itself", () => {
    const adj = buildAdjacency([]);
    expect(areConnected(adj, "A", "A")).toBe(true);
  });

  it("finds a path that only exists when a continuity gate is closed", () => {
    const wires: WireEdge[] = [
      { from: "supply", to: "front:top:0" },
      { from: "front:top:1", to: "load" },
    ];
    const adj = buildAdjacency(wires);
    const openGate: ContinuityGate = {
      a: "front:top:0",
      b: "front:top:1",
      closed: false,
    };
    const closedGate: ContinuityGate = { ...openGate, closed: true };

    expect(areConnected(adj, "supply", "load", [openGate])).toBe(false);
    expect(areConnected(adj, "supply", "load", [closedGate])).toBe(true);
  });

  it("ignores open gates", () => {
    const wires: WireEdge[] = [
      { from: "supply", to: "front:top:0" },
      { from: "front:top:1", to: "load" },
    ];
    const adj = buildAdjacency(wires);
    expect(
      areConnected(adj, "supply", "load", [
        { a: "front:top:0", b: "front:top:1", closed: false },
      ]),
    ).toBe(false);
  });
});
