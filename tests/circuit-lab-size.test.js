import { describe, it, expect } from "vitest";
import {
  normalizeCssSize,
  applyCircuitLabSizeAttributes,
} from "../js/circuit-lab-size.js";

describe("normalizeCssSize", () => {
  it("returns null for missing or blank values", () => {
    expect(normalizeCssSize(null)).toBeNull();
    expect(normalizeCssSize(undefined)).toBeNull();
    expect(normalizeCssSize("")).toBeNull();
    expect(normalizeCssSize("   ")).toBeNull();
  });

  it("appends px to bare numbers", () => {
    expect(normalizeCssSize("800")).toBe("800px");
    expect(normalizeCssSize("600.5")).toBe("600.5px");
    expect(normalizeCssSize("  400  ")).toBe("400px");
  });

  it("passes through CSS length values", () => {
    expect(normalizeCssSize("100%")).toBe("100%");
    expect(normalizeCssSize("50vh")).toBe("50vh");
    expect(normalizeCssSize("40rem")).toBe("40rem");
    expect(normalizeCssSize("720px")).toBe("720px");
  });
});

describe("applyCircuitLabSizeAttributes", () => {
  it("sets inline width and height from attributes", () => {
    const el = document.createElement("div");
    el.setAttribute("width", "900");
    el.setAttribute("height", "70%");

    applyCircuitLabSizeAttributes(el);

    expect(el.style.width).toBe("900px");
    expect(el.style.height).toBe("70%");
  });

  it("clears inline size when attributes are removed", () => {
    const el = document.createElement("div");
    el.style.width = "500px";
    el.style.height = "400px";

    applyCircuitLabSizeAttributes(el);

    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
  });
});
