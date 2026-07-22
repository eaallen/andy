import { describe, expect, it } from "vitest";
import { switchBridgePairs } from "../js/components/switch-shared.js";

describe("switchBridgePairs", () => {
  it("hides the SPST bridge while open and links COM→NO when closed", () => {
    expect(switchBridgePairs("spst", false)).toEqual([]);
    expect(switchBridgePairs("spst", true)).toEqual([["com", "no"]]);
  });

  it("always bridges COM to exactly one traveler on a three-way", () => {
    expect(switchBridgePairs("three-way", false)).toEqual([["com", "t1"]]);
    expect(switchBridgePairs("three-way", true)).toEqual([["com", "t2"]]);
  });

  it("swaps four-way traveler pairs between straight and cross", () => {
    expect(switchBridgePairs("four-way", false)).toEqual([
      ["a1", "b1"],
      ["a2", "b2"],
    ]);
    expect(switchBridgePairs("four-way", true)).toEqual([
      ["a1", "b2"],
      ["a2", "b1"],
    ]);
  });
});
