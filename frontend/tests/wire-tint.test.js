import { describe, expect, it } from "vitest";
import {
  bendHandleColors,
  hexLuminance,
  hexToRgba,
  lightenHex,
  parseHexColor,
  rgbToHex,
} from "../js/wire-tint.js";

describe("wire-tint", () => {
  it("parses #rgb and #rrggbb", () => {
    expect(parseHexColor("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor("#dc2626")).toEqual({ r: 220, g: 38, b: 38 });
    expect(parseHexColor("nope")).toBeNull();
  });

  it("lightens toward white", () => {
    expect(lightenHex("#000000", 0)).toBe("#000000");
    expect(lightenHex("#000000", 1)).toBe("#ffffff");
    expect(lightenHex("#dc2626", 0.5)).toBe(rgbToHex(237.5, 146.5, 146.5));
  });

  it("builds rgba strings", () => {
    expect(hexToRgba("#2563eb", 0.5)).toBe("rgba(37, 99, 235, 0.5)");
  });

  it("tints bend handles from the wire color", () => {
    const red = bendHandleColors("#dc2626");
    expect(red.fill).toBe(lightenHex("#dc2626", 0.82));
    expect(red.stroke).toBe(lightenHex("#dc2626", 0.28));
    expect(red.haloFill.startsWith("rgba(")).toBe(true);
  });

  it("uses a gray fallback for near-white wires", () => {
    expect(hexLuminance("#ffffff")).toBeGreaterThan(0.85);
    const white = bendHandleColors("#ffffff");
    expect(white.fill).toBe("#f4f4f5");
    expect(white.stroke).toBe("#a1a1aa");
  });
});
