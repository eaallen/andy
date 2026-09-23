import { describe, expect, it } from "vitest";
import {
  SHORT_AMP_CAP,
  WIRE_OHMS,
  DEFAULT_LAMP_OHMS,
  defaultOhmsForComponentType,
} from "../js/electrical.js";
import { formatAmps, formatOhms, formatVolts } from "../js/circuit-format.js";
import { solveResistiveNetwork } from "../js/circuit-solve.js";

describe("solveResistiveNetwork", () => {
  it("solves a single load across the supply", () => {
    const r = 120;
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [{ id: "load:r1", from: "hot", to: "ret", ohms: r }],
    });

    expect(result.voltages.hot).toBe(120);
    expect(result.voltages.ret).toBe(0);
    expect(result.currents["load:r1"]).toBeCloseTo(1, 5);
    expect(result.short).toBe(false);
  });

  it("shares current in series and splits voltage", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [
        { id: "load:r1", from: "hot", to: "mid", ohms: 60 },
        { id: "load:r2", from: "mid", to: "ret", ohms: 60 },
      ],
    });

    expect(result.voltages.mid).toBeCloseTo(60, 5);
    expect(result.currents["load:r1"]).toBeCloseTo(1, 5);
    expect(result.currents["load:r2"]).toBeCloseTo(1, 5);
  });

  it("adds currents in parallel", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [
        { id: "load:a", from: "hot", to: "ret", ohms: 120 },
        { id: "load:b", from: "hot", to: "ret", ohms: 120 },
      ],
    });

    expect(result.currents["load:a"]).toBeCloseTo(1, 5);
    expect(result.currents["load:b"]).toBeCloseTo(1, 5);
  });

  it("returns near-zero current when the only path is open (no load branch)", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [
        { id: "wire:1", from: "hot", to: "a", ohms: WIRE_OHMS },
        { id: "wire:2", from: "ret", to: "b", ohms: WIRE_OHMS },
      ],
    });

    expect(Math.abs(result.currents["wire:1"])).toBeLessThan(1e-6);
    expect(Math.abs(result.currents["wire:2"])).toBeLessThan(1e-6);
  });

  it("energizes a reverse-polarity lamp the same as correct polarity", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [
        { id: "wire:1", from: "hot", to: "lamp:n", ohms: WIRE_OHMS },
        { id: "load:lamp", from: "lamp:hot", to: "lamp:n", ohms: 120 },
        { id: "wire:2", from: "lamp:hot", to: "ret", ohms: WIRE_OHMS },
      ],
    });

    expect(Math.abs(result.currents["load:lamp"])).toBeCloseTo(1, 3);
    expect(result.voltages["lamp:n"]).toBeCloseTo(120, 1);
    expect(result.voltages["lamp:hot"]).toBeCloseTo(0, 1);
  });

  it("models split-phase: L1=+V, L2=-V so L1–L2 is 2V", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { l1: 120, l2: -120, n: 0 },
      branches: [
        { id: "load:a", from: "l1", to: "n", ohms: 120 },
        { id: "load:b", from: "l2", to: "n", ohms: 120 },
      ],
    });

    expect(result.voltages.l1 - result.voltages.n).toBeCloseTo(120, 6);
    expect(result.voltages.l1 - result.voltages.l2).toBeCloseTo(240, 6);
    expect(result.currents["load:a"]).toBeCloseTo(1, 5);
    expect(result.currents["load:b"]).toBeCloseTo(-1, 5);
  });

  it("keeps isolated islands independent (secondary does not leak to primary)", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: {
        "pri:hot": 120,
        "pri:n": 0,
        "sec:hot": 24,
        "sec:com": 0,
      },
      branches: [
        { id: "load:pri", from: "pri:hot", to: "pri:n", ohms: 120 },
        { id: "load:sec", from: "sec:hot", to: "sec:com", ohms: 24 },
      ],
    });

    expect(result.currents["load:pri"]).toBeCloseTo(1, 5);
    expect(result.currents["load:sec"]).toBeCloseTo(1, 5);
    expect(result.voltages["pri:hot"]).toBe(120);
    expect(result.voltages["sec:hot"]).toBe(24);
  });

  it("flags a hard short across the supply", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [{ id: "wire:short", from: "hot", to: "ret", ohms: WIRE_OHMS }],
    });

    expect(Math.abs(result.currents["wire:short"])).toBeGreaterThan(SHORT_AMP_CAP);
    expect(result.short).toBe(true);
  });

  it("solves series-parallel: shared series current, parallel at full V", () => {
    const result = solveResistiveNetwork({
      fixedVoltages: { hot: 120, ret: 0 },
      branches: [
        { id: "wire:1", from: "hot", to: "r1a", ohms: WIRE_OHMS },
        { id: "load:r1", from: "r1a", to: "r1b", ohms: 60 },
        { id: "wire:2", from: "r1b", to: "r2a", ohms: WIRE_OHMS },
        { id: "load:r2", from: "r2a", to: "r2b", ohms: 60 },
        { id: "wire:3", from: "r2b", to: "ret", ohms: WIRE_OHMS },
        { id: "load:r3", from: "hot", to: "ret", ohms: 120 },
      ],
    });

    expect(result.currents["load:r1"]).toBeCloseTo(1, 3);
    expect(result.currents["load:r2"]).toBeCloseTo(1, 3);
    expect(result.currents["load:r3"]).toBeCloseTo(1, 3);
    expect(result.voltages.r1a - result.voltages.r1b).toBeCloseTo(60, 1);
    expect(result.voltages.r2a - result.voltages.r2b).toBeCloseTo(60, 1);
  });
});

describe("formatters and defaults", () => {
  it("formats volts, amps, and ohms for trades display", () => {
    expect(formatVolts(120)).toBe("120 V");
    expect(formatVolts(60.04)).toBe("60 V");
    expect(formatVolts(0.01)).toBe("0 V");
    expect(formatAmps(0.833)).toBe("0.83 A");
    expect(formatAmps(-0.833)).toBe("0.83 A");
    expect(formatAmps(-12.4)).toBe("12.4 A");
    expect(formatAmps(100, true)).toBe(">50 A");
    expect(formatOhms(144)).toBe("144 Ω");
    expect(formatOhms(2200)).toBe("2.2 kΩ");
  });

  it("returns conductive defaults for lamp/chime/resistor and null for probes", () => {
    expect(defaultOhmsForComponentType("lamp")).toBe(DEFAULT_LAMP_OHMS);
    expect(defaultOhmsForComponentType("chime")).toBe(24);
    expect(defaultOhmsForComponentType("resistor")).toBe(100);
    expect(defaultOhmsForComponentType("receptacle")).toBeNull();
    expect(defaultOhmsForComponentType("gfci")).toBeNull();
  });
});
