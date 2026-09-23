import { describe, expect, it } from "vitest";
import {
  formatLoadMeasurement,
  formatWireMeasurement,
} from "../js/circuit-format.js";
import {
  offsetBesideWire,
  pointAndNormalAlongPoints,
} from "../js/measurements-overlay.js";

describe("formatLoadMeasurement", () => {
  it("joins ohms, volts, amps, and watts for trades display", () => {
    expect(
      formatLoadMeasurement({ ohms: 60, volts: 60, amps: 1 })
    ).toBe("60 Ω · 60 V · 1.00 A · 60 W");
  });

  it("omits missing parts and caps short currents", () => {
    expect(formatLoadMeasurement({ ohms: 100 })).toBe("100 Ω");
    expect(formatLoadMeasurement({ amps: 200, short: true })).toBe(">50 A");
  });
});

describe("pointAndNormalAlongPoints", () => {
  it("returns the halfway point along a polyline", () => {
    expect(pointAndNormalAlongPoints([0, 0, 10, 0, 10, 10])).toMatchObject({
      x: 10,
      y: 0,
    });
    expect(pointAndNormalAlongPoints([0, 0, 100, 0])).toMatchObject({
      x: 50,
      y: 0,
    });
  });

  it("returns null for too-short point lists", () => {
    expect(pointAndNormalAlongPoints([0, 0])).toBeNull();
    expect(pointAndNormalAlongPoints(null)).toBeNull();
  });
});

describe("formatWireMeasurement", () => {
  it("stacks current above conductor voltage for checking a wire", () => {
    expect(formatWireMeasurement({ amps: 1, volts: 60 })).toBe("1.00 A\n60 V");
    expect(formatWireMeasurement({ amps: 0, volts: 120 })).toBe("0 A\n120 V");
  });
});

describe("offsetBesideWire", () => {
  it("nudge a horizontal wire's label off the stroke", () => {
    const along = pointAndNormalAlongPoints([0, 0, 100, 0]);
    const beside = offsetBesideWire(along, 10);
    expect(along.y).toBe(0);
    expect(beside.y).not.toBe(0);
    expect(beside.x).toBeCloseTo(50, 5);
  });
});
