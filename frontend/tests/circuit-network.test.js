import { describe, expect, it } from "vitest";
import {
  buildFixedVoltages,
  buildNetworkBranches,
  interpretSolveResult,
  wireCurrentsFromBranches,
} from "../js/circuit-network.js";

describe("circuit-network", () => {
  it("stamps split-phase fixed voltages", () => {
    expect(buildFixedVoltages(["l1", "l2"], "n", 120)).toEqual({
      n: 0,
      l1: 120,
      l2: -120,
    });
  });

  it("uses stamped load.ohms only (no runtime default walk)", () => {
    const branches = buildNetworkBranches({
      wires: [{ from: { id: "a" }, to: { id: "b" } }],
      bridges: [],
      loads: [
        {
          id: "lamp",
          ohms: 144,
          requireHot: { component: "lamp", terminal: "hot" },
          signal: { component: "lamp", terminal: "n" },
        },
        {
          id: "probe",
          ohms: null,
          requireHot: { component: "rec", terminal: "hot" },
          signal: { component: "rec", terminal: "n" },
        },
      ],
      terminalKey: function (t) {
        return t.id || t.component + "." + t.terminal;
      },
      resolveEndpoint: function (ref) {
        return { id: ref.component + "." + ref.terminal };
      },
    });

    expect(branches.filter((b) => b.kind === "load").map((b) => b.id)).toEqual([
      "load:lamp",
    ]);
    expect(branches.find((b) => b.kind === "wire").wireIndex).toBe(0);
  });

  it("maps wire currents by wireIndex, not by overlay re-walking getWires", () => {
    const wireCurrents = wireCurrentsFromBranches(
      [
        { id: "wire:0", kind: "wire", wireIndex: 0 },
        { id: "wire:2", kind: "wire", wireIndex: 2 },
      ],
      { "wire:0": 1.5, "wire:2": 0.25 },
      3
    );
    expect(wireCurrents[0]).toBe(1.5);
    expect(wireCurrents[1]).toBeUndefined();
    expect(wireCurrents[2]).toBe(0.25);
  });

  it("interprets conductive vs probe energize from stamped ohms", () => {
    const result = interpretSolveResult(
      {
        voltages: { hot: 120, n: 0, "lamp.hot": 120, "lamp.n": 0 },
        currents: { "load:lamp": 1, "wire:0": 1 },
        short: false,
        branches: [
          { id: "wire:0", kind: "wire", wireIndex: 0, from: "hot", to: "lamp.hot" },
          { id: "load:lamp", kind: "load", from: "lamp.hot", to: "lamp.n" },
        ],
      },
      {
        loads: [
          {
            id: "lamp",
            ohms: 120,
            requireHot: { component: "lamp", terminal: "hot" },
            signal: { component: "lamp", terminal: "n" },
          },
        ],
        returnKey: "n",
        wireCount: 1,
        terminalKey: function (t) {
          return t.id;
        },
        resolveEndpoint: function (ref) {
          return { id: ref.component + "." + ref.terminal };
        },
        emptyEnergized: function () {
          return { lamp: false };
        },
      }
    );

    expect(result.energized.lamp).toBe(true);
    expect(result.loadCurrents.lamp).toBe(1);
    expect(result.wireCurrents[0]).toBe(1);
  });
});
