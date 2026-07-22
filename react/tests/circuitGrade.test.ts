import { describe, expect, it } from "vitest";
import { gradeContinuity } from "../src/circuit/grade";
import type { WireEdge } from "../src/circuit/graph";

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
