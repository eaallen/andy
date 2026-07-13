import { describe, it, expect } from "vitest";
import {
  COMPONENT_TYPES,
  COMPONENT_REGISTRY,
  TERMINAL_ROLES,
  makeComponentFromEntry,
} from "../js/components.js";

describe("COMPONENT_REGISTRY", () => {
  it("registers all built-in component types including switch and lamp", () => {
    const expected = [
      COMPONENT_TYPES.POWER,
      COMPONENT_TYPES.TRANSFORMER,
      COMPONENT_TYPES.CHIME,
      COMPONENT_TYPES.BUTTON,
      COMPONENT_TYPES.SWITCH,
      COMPONENT_TYPES.LAMP,
      COMPONENT_TYPES.TERMINAL_BLOCK,
      "terminal-block",
    ];
    for (let i = 0; i < expected.length; i += 1) {
      const type = expected[i];
      expect(typeof COMPONENT_REGISTRY[type]).toBe("function");
    }
  });

  it("exposes load and switch terminal roles", () => {
    expect(TERMINAL_ROLES.LOAD_HOT).toBe("loadHot");
    expect(TERMINAL_ROLES.LOAD_NEUTRAL).toBe("loadNeutral");
    expect(TERMINAL_ROLES.SWITCH_COM).toBe("switchCom");
    expect(TERMINAL_ROLES.SWITCH_NO).toBe("switchNo");
  });

  it("rejects unknown component types", () => {
    expect(function () {
      makeComponentFromEntry({ id: "x", type: "gfci", x: 0, y: 0 });
    }).toThrow(/Unknown component type "gfci"/);
  });

  it("builds switch and lamp groups from registry entries", () => {
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
    expect(sw.isClosed).toBe(false);
    expect(
      sw.terminals.map(function (t) {
        return t.id;
      })
    ).toEqual(["com", "no"]);
    expect(sw.terminals[0].role).toBe(TERMINAL_ROLES.SWITCH_COM);
    expect(sw.terminals[1].role).toBe(TERMINAL_ROLES.SWITCH_NO);

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
    expect(lamp.terminals[0].role).toBe(TERMINAL_ROLES.LOAD_HOT);
    expect(lamp.terminals[1].role).toBe(TERMINAL_ROLES.LOAD_NEUTRAL);
  });
});
