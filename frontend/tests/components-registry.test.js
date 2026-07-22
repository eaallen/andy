import { describe, it, expect } from "vitest";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "../js/components/constants.js";
import { COMPONENT_REGISTRY, makeComponentFromEntry } from "../js/components/registry.js";

describe("COMPONENT_REGISTRY", () => {
  it("registers all built-in component types including multi-throw and GFCI", () => {
    const expected = [
      COMPONENT_TYPES.POWER,
      COMPONENT_TYPES.TRANSFORMER,
      COMPONENT_TYPES.CHIME,
      COMPONENT_TYPES.BUTTON,
      COMPONENT_TYPES.SWITCH,
      COMPONENT_TYPES.THREE_WAY,
      COMPONENT_TYPES.FOUR_WAY,
      COMPONENT_TYPES.LAMP,
      COMPONENT_TYPES.RECEPTACLE,
      COMPONENT_TYPES.GFCI,
      COMPONENT_TYPES.TERMINAL_BLOCK,
      "terminal-block",
      "threeWay",
      "fourWay",
    ];
    for (let i = 0; i < expected.length; i += 1) {
      const type = expected[i];
      expect(typeof COMPONENT_REGISTRY[type]).toBe("function");
    }
  });

  it("exposes load, traveler, and GFCI terminal roles", () => {
    expect(TERMINAL_ROLES.LOAD_HOT).toBe("loadHot");
    expect(TERMINAL_ROLES.LOAD_NEUTRAL).toBe("loadNeutral");
    expect(TERMINAL_ROLES.SWITCH_COM).toBe("switchCom");
    expect(TERMINAL_ROLES.SWITCH_NO).toBe("switchNo");
    expect(TERMINAL_ROLES.TRAVELER_1).toBe("traveler1");
    expect(TERMINAL_ROLES.TRAVELER_2).toBe("traveler2");
    expect(TERMINAL_ROLES.L2).toBe("l2");
    expect(TERMINAL_ROLES.LINE_HOT).toBe("lineHot");
  });

  it("rejects unknown component types", () => {
    expect(function () {
      makeComponentFromEntry({ id: "x", type: "not-a-real-type", x: 0, y: 0 });
    }).toThrow(/Unknown component type "not-a-real-type"/);
  });

  it("builds switch, three-way, four-way, gfci, and lamp groups from registry entries", () => {
    const sw = makeComponentFromEntry({
      id: "sw1",
      type: "switch",
      label: "SPST",
      x: 10,
      y: 20,
    });
    expect(sw.componentType).toBe(COMPONENT_TYPES.SWITCH);
    expect(sw.isSwitch).toBe(true);
    expect(sw.isToggle).toBe(true);
    expect(sw.switchKind).toBe("spst");
    expect(sw.isClosed).toBe(false);
    expect(
      sw.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["com", "no"]);

    const three = makeComponentFromEntry({
      id: "tw1",
      type: "three-way",
      label: "3W",
      x: 0,
      y: 0,
    });
    expect(three.componentType).toBe(COMPONENT_TYPES.THREE_WAY);
    expect(three.switchKind).toBe("three-way");
    expect(
      three.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["t1", "com", "t2"]);

    const four = makeComponentFromEntry({
      id: "fw1",
      type: "four-way",
      x: 0,
      y: 0,
    });
    expect(four.componentType).toBe(COMPONENT_TYPES.FOUR_WAY);
    expect(
      four.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["a1", "a2", "b1", "b2"]);

    const gfci = makeComponentFromEntry({
      id: "g1",
      type: "gfci",
      x: 0,
      y: 0,
    });
    expect(gfci.componentType).toBe(COMPONENT_TYPES.GFCI);
    expect(gfci.hasInternalBridges).toBe(true);
    expect(
      gfci.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["line-hot", "line-n", "line-g", "load-hot", "load-n", "load-g"]);

    const lamp = makeComponentFromEntry({
      id: "lamp1",
      type: "lamp",
      label: "Ceiling",
      x: 30,
      y: 40,
    });
    expect(lamp.componentType).toBe(COMPONENT_TYPES.LAMP);
    expect(lamp.isLit).toBe(false);
    expect(
      lamp.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["hot", "n"]);
  });

  it("builds power with one hot leg by default", () => {
    const power = makeComponentFromEntry({
      id: "power",
      type: "power",
      x: 0,
      y: 0,
    });
    expect(power.powerLegs).toBe(1);
    expect(power.powerKind).toBe("ac");
    expect(
      power.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["l1", "n", "g"]);
  });

  it("builds power with configurable hot legs", () => {
    const power = makeComponentFromEntry({
      id: "power",
      type: "power",
      legs: 2,
      x: 0,
      y: 0,
    });
    expect(power.powerLegs).toBe(2);
    expect(
      power.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["l1", "l2", "n", "g"]);
  });

  it("builds power with dc kind", () => {
    const power = makeComponentFromEntry({
      id: "power",
      type: "power",
      kind: "dc",
      x: 0,
      y: 0,
    });
    expect(power.powerKind).toBe("dc");
  });
});
