import { describe, expect, it } from "vitest";
import { LAB_BRIDGES } from "../src/circuit/labBridges";
import {
  areConnected,
  bridgeEdgesForClosed,
  buildAdjacency,
} from "../src/circuit/graph";
import { isLoadEnergized } from "../src/circuit/energize";
import { SWITCH_TERMINALS } from "../src/comps/Switch";
import { terminalKey } from "../src/comps/terminals";

describe("LAB_BRIDGES switch", () => {
  it("bridges COM to NO only when the switch id is closed", () => {
    const com = terminalKey("switch", "top", SWITCH_TERMINALS.com);
    const no = terminalKey("switch", "top", SWITCH_TERMINALS.no);

    expect(LAB_BRIDGES.switch).toEqual([{ from: com, to: no }]);

    const openAdj = buildAdjacency(bridgeEdgesForClosed([], LAB_BRIDGES));
    expect(areConnected(openAdj, com, no)).toBe(false);

    const closedAdj = buildAdjacency(
      bridgeEdgesForClosed(["switch"], LAB_BRIDGES),
    );
    expect(areConnected(closedAdj, com, no)).toBe(true);
  });

  it("lights a series lamp only while the SPST switch is closed", () => {
    const com = terminalKey("switch", "top", SWITCH_TERMINALS.com);
    const no = terminalKey("switch", "top", SWITCH_TERMINALS.no);
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

    const openAdj = buildAdjacency(wires);
    expect(isLoadEnergized(openAdj, supply, lamp)).toBe(false);

    const closedAdj = buildAdjacency([
      ...wires,
      ...bridgeEdgesForClosed(["switch"], LAB_BRIDGES),
    ]);
    expect(isLoadEnergized(closedAdj, supply, lamp)).toBe(true);
  });
});
