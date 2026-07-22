import { describe, expect, it } from "vitest";
import { areConnected, buildAdjacency } from "../src/circuit/graph";
import { isLoadEnergized } from "../src/circuit/energize";
import { SWITCH_TERMINALS } from "../src/comps/Switch";
import { terminalKey } from "../src/comps/terminals";

describe("SPST switch continuity gate", () => {
  const com = terminalKey("switch", "top", SWITCH_TERMINALS.com);
  const no = terminalKey("switch", "top", SWITCH_TERMINALS.no);

  it("connects COM to NO only while the gate is closed", () => {
    const adj = buildAdjacency([]);
    const open = { a: com, b: no, closed: false };
    const closed = { a: com, b: no, closed: true };

    expect(areConnected(adj, com, no, [open])).toBe(false);
    expect(areConnected(adj, com, no, [closed])).toBe(true);
  });

  it("lights a series lamp only while the SPST switch is closed", () => {
    const supply = {
      hot: ["power:top:0"],
      return: "power:top:1",
    };
    const lamp = {
      requireHot: "lamp:bottom:0",
      signal: "lamp:bottom:1",
    };
    const wires = [
      { from: "power:top:0", to: com },
      { from: no, to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);
    const gate = { a: com, b: no, closed: false };

    expect(isLoadEnergized(adj, supply, lamp, [gate])).toBe(false);
    expect(
      isLoadEnergized(adj, supply, lamp, [{ ...gate, closed: true }]),
    ).toBe(true);
  });
});
