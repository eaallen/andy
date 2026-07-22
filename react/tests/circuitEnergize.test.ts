import { describe, expect, it } from "vitest";
import {
  isLoadEnergized,
  isLoadPolarityCorrect,
} from "../src/circuit/energize";
import {
  bridgeEdgesForClosed,
  buildAdjacency,
  type ComponentBridges,
  type WireEdge,
} from "../src/circuit/graph";

const SUPPLY = {
  hot: ["power:top:0"],
  return: "power:top:1",
};

const LAMP = {
  requireHot: "lamp:bottom:0",
  signal: "lamp:bottom:1",
};

describe("isLoadEnergized", () => {
  it("lights the lamp when hot and neutral both reach the supply", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadEnergized(adj, SUPPLY, LAMP)).toBe(true);
  });

  it("lights when hot and neutral are swapped (real-life polarity)", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:1" },
      { from: "power:top:1", to: "lamp:bottom:0" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadEnergized(adj, SUPPLY, LAMP)).toBe(true);
  });

  it("stays dark when only the hot leg is wired", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:0" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadEnergized(adj, SUPPLY, LAMP)).toBe(false);
  });

  it("stays dark when only the neutral leg is wired", () => {
    const wires: WireEdge[] = [
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadEnergized(adj, SUPPLY, LAMP)).toBe(false);
  });

  it("lights only while a series switch bridge is closed", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "front:top:0" },
      { from: "front:top:1", to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const bridges: ComponentBridges = {
      front: [{ from: "front:top:0", to: "front:top:1" }],
    };

    const openAdj = buildAdjacency(wires);
    expect(isLoadEnergized(openAdj, SUPPLY, LAMP)).toBe(false);

    const closedAdj = buildAdjacency([
      ...wires,
      ...bridgeEdgesForClosed(["front"], bridges),
    ]);
    expect(isLoadEnergized(closedAdj, SUPPLY, LAMP)).toBe(true);
  });

  it("returns false when supply has no hot terminals", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);
    expect(
      isLoadEnergized(adj, { hot: [], return: SUPPLY.return }, LAMP),
    ).toBe(false);
  });
});

describe("isLoadPolarityCorrect", () => {
  it("passes for labeled hot→hot and COM→neutral wiring", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadPolarityCorrect(adj, SUPPLY, LAMP)).toBe(true);
  });

  it("fails when hot and neutral are swapped even if the lamp would light", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:1" },
      { from: "power:top:1", to: "lamp:bottom:0" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadEnergized(adj, SUPPLY, LAMP)).toBe(true);
    expect(isLoadPolarityCorrect(adj, SUPPLY, LAMP)).toBe(false);
  });

  it("fails when a required leg is missing", () => {
    const wires: WireEdge[] = [
      { from: "power:top:0", to: "lamp:bottom:0" },
    ];
    const adj = buildAdjacency(wires);
    expect(isLoadPolarityCorrect(adj, SUPPLY, LAMP)).toBe(false);
  });
});
