import { describe, expect, it } from "vitest";
import {
  areConnected,
  bridgeEdgesForClosed,
  buildAdjacency,
  reachableFrom,
  type ComponentBridges,
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

  it("finds a path that only exists when a switch bridge is closed", () => {
    const wires: WireEdge[] = [
      { from: "supply", to: "front:top:0" },
      { from: "front:top:1", to: "load" },
    ];
    const bridges: ComponentBridges = {
      front: [{ from: "front:top:0", to: "front:top:1" }],
    };

    const openAdj = buildAdjacency(wires);
    expect(areConnected(openAdj, "supply", "load")).toBe(false);

    const closedAdj = buildAdjacency([
      ...wires,
      ...bridgeEdgesForClosed(["front"], bridges),
    ]);
    expect(areConnected(closedAdj, "supply", "load")).toBe(true);
  });

  it("drops the bridge path when the switch is open", () => {
    const wires: WireEdge[] = [
      { from: "supply", to: "front:top:0" },
      { from: "front:top:1", to: "load" },
    ];
    const bridges: ComponentBridges = {
      front: [{ from: "front:top:0", to: "front:top:1" }],
    };
    const adj = buildAdjacency([
      ...wires,
      ...bridgeEdgesForClosed([], bridges),
    ]);
    expect(areConnected(adj, "supply", "load")).toBe(false);
  });
});

describe("bridgeEdgesForClosed", () => {
  it("only emits bridges for listed closed ids", () => {
    const bridges: ComponentBridges = {
      front: [{ from: "front:top:0", to: "front:top:1" }],
      rear: [{ from: "rear:top:0", to: "rear:top:1" }],
    };
    expect(bridgeEdgesForClosed(["rear"], bridges)).toEqual([
      { from: "rear:top:0", to: "rear:top:1" },
    ]);
  });
});
