import { describe, expect, it } from "vitest";
import { areConnected, buildAdjacency } from "../src/circuit/graph";
import { isLoadEnergized } from "../src/circuit/energize";
import { THREE_WAY_TERMINALS } from "../src/comps/ThreeWaySwitch";
import { terminalKey } from "../src/comps/terminals";

describe("three-way switch continuity gates", () => {
  const com = terminalKey("threeWay", "top", THREE_WAY_TERMINALS.com);
  const t1 = terminalKey("threeWay", "top", THREE_WAY_TERMINALS.t1);
  const t2 = terminalKey("threeWay", "top", THREE_WAY_TERMINALS.t2);

  function threeWayGates(closed: boolean) {
    return [
      { a: com, b: t1, closed: !closed },
      { a: com, b: t2, closed: closed },
    ];
  }

  it("bridges COM to T1 when open and COM to T2 when closed", () => {
    const adj = buildAdjacency([]);

    expect(areConnected(adj, com, t1, threeWayGates(false))).toBe(true);
    expect(areConnected(adj, com, t2, threeWayGates(false))).toBe(false);

    expect(areConnected(adj, com, t1, threeWayGates(true))).toBe(false);
    expect(areConnected(adj, com, t2, threeWayGates(true))).toBe(true);
  });

  it("never bridges T1 directly to T2 through the device", () => {
    const adj = buildAdjacency([]);
    expect(areConnected(adj, t1, t2, threeWayGates(false))).toBe(false);
    expect(areConnected(adj, t1, t2, threeWayGates(true))).toBe(false);
  });

  it("lights a lamp through matching traveler throws on two 3-ways", () => {
    const sw1Com = terminalKey("sw1", "top", THREE_WAY_TERMINALS.com);
    const sw1T1 = terminalKey("sw1", "top", THREE_WAY_TERMINALS.t1);
    const sw1T2 = terminalKey("sw1", "top", THREE_WAY_TERMINALS.t2);
    const sw2Com = terminalKey("sw2", "top", THREE_WAY_TERMINALS.com);
    const sw2T1 = terminalKey("sw2", "top", THREE_WAY_TERMINALS.t1);
    const sw2T2 = terminalKey("sw2", "top", THREE_WAY_TERMINALS.t2);

    const supply = {
      hot: ["power:top:0"],
      return: "power:top:1",
    };
    const lamp = {
      requireHot: "lamp:bottom:0",
      signal: "lamp:bottom:1",
    };
    const wires = [
      { from: "power:top:0", to: sw1Com },
      { from: sw1T1, to: sw2T1 },
      { from: sw1T2, to: sw2T2 },
      { from: sw2Com, to: "lamp:bottom:0" },
      { from: "power:top:1", to: "lamp:bottom:1" },
    ];
    const adj = buildAdjacency(wires);

    function gatesFor(prefix: string, closed: boolean) {
      const c = terminalKey(prefix, "top", THREE_WAY_TERMINALS.com);
      const a = terminalKey(prefix, "top", THREE_WAY_TERMINALS.t1);
      const b = terminalKey(prefix, "top", THREE_WAY_TERMINALS.t2);
      return [
        { a: c, b: a, closed: !closed },
        { a: c, b: b, closed: closed },
      ];
    }

    // Same traveler (both T1) → lamp on
    expect(
      isLoadEnergized(adj, supply, lamp, [
        ...gatesFor("sw1", false),
        ...gatesFor("sw2", false),
      ]),
    ).toBe(true);

    // Mismatched travelers → lamp off
    expect(
      isLoadEnergized(adj, supply, lamp, [
        ...gatesFor("sw1", false),
        ...gatesFor("sw2", true),
      ]),
    ).toBe(false);

    // Same traveler (both T2) → lamp on
    expect(
      isLoadEnergized(adj, supply, lamp, [
        ...gatesFor("sw1", true),
        ...gatesFor("sw2", true),
      ]),
    ).toBe(true);
  });
});
