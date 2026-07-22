import { describe, expect, it } from "vitest";
import { gradeContinuity, gradeLoadPolarity } from "../src/circuit/grade";
import { buildAdjacency, type WireEdge } from "../src/circuit/graph";

describe("gradeContinuity", () => {
  it("passes when all expected paths exist", () => {
    const wires: WireEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    const result = gradeContinuity(wires, [
      { from: "A", to: "C" },
      { from: "A", to: "B" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("reports a custom fail message for a missing path", () => {
    const wires: WireEdge[] = [{ from: "A", to: "B" }];
    const result = gradeContinuity(wires, [
      {
        from: "A",
        to: "C",
        fail: "Front button is not wired to the chime.",
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "Front button is not wired to the chime.",
    ]);
  });

  it("uses a default fail message when none is provided", () => {
    const result = gradeContinuity([], [{ from: "x", to: "y" }]);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "Expected continuity was not found between x and y.",
    ]);
  });
});

describe("gradeLoadPolarity", () => {
  const supply = {
    hot: ["power:top:0"],
    return: "power:top:1",
  };
  const load = {
    requireHot: "lamp:bottom:0",
    signal: "lamp:bottom:1",
  };

  it("passes when polarity matches the labeled terminals", () => {
    const adj = buildAdjacency([
      { from: "power:top:0", to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ]);
    expect(gradeLoadPolarity(adj, supply, load)).toEqual({
      ok: true,
      failures: [],
    });
  });

  it("deducts with a custom message when polarity is reversed", () => {
    const adj = buildAdjacency([
      { from: "power:top:0", to: "lamp:bottom:1" },
      { from: "power:top:1", to: "lamp:bottom:0" },
    ]);
    const result = gradeLoadPolarity(
      adj,
      supply,
      load,
      "Lamp + should land on L1, not N.",
    );
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["Lamp + should land on L1, not N."]);
  });
});
