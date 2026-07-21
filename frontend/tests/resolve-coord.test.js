import { describe, expect, it } from "vitest";
import { resolveCoord } from "../js/lab-config.js";

const stage = { width: 1000, height: 600, margin: 40 };

describe("resolveCoord", () => {
  it("returns finite numbers as-is", () => {
    expect(resolveCoord(120, "x", stage)).toBe(120);
    expect(resolveCoord(0, "y", stage)).toBe(0);
  });

  it("parses numeric strings", () => {
    expect(resolveCoord("40", "x", stage)).toBe(40);
    expect(resolveCoord("-10", "y", stage)).toBe(-10);
  });

  it("resolves percentages against the stage axis", () => {
    expect(resolveCoord("42%", "x", stage)).toBe(420);
    expect(resolveCoord("50%", "y", stage)).toBe(300);
  });

  it("resolves named positions with optional offsets", () => {
    expect(resolveCoord("margin", "x", stage)).toBe(40);
    expect(resolveCoord("center", "x", stage)).toBe(500);
    expect(resolveCoord("center-140", "x", stage)).toBe(360);
    expect(resolveCoord("center+64", "x", stage)).toBe(564);
    expect(resolveCoord("right-190", "x", stage)).toBe(810);
    expect(resolveCoord("bottom-128", "y", stage)).toBe(472);
  });
});
