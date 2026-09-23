import { describe, expect, it } from "vitest";
import {
  buildHintRefCatalog,
  formatHintRef,
  formatHintRefList,
  linkifyHintText,
  resolveHintRef,
} from "../js/hint-refs.js";

/**
 * Minimal doorbell-shaped normalized config for catalog tests.
 */
function doorbellConfig() {
  return {
    components: [
      { id: "chime" },
      { id: "transformer" },
      { id: "buttonFront" },
      { id: "buttonRear" },
      { id: "buttonSide" },
    ],
    simulation: {
      loads: [
        {
          id: "front",
          requireHot: { component: "chime", terminal: "trans" },
          signal: { component: "chime", terminal: "front" },
        },
        {
          id: "rear",
          requireHot: { component: "chime", terminal: "trans" },
          signal: { component: "chime", terminal: "rear" },
        },
      ],
    },
  };
}

describe("formatHintRef", () => {
  it("wraps ids in brackets and joins lists", () => {
    expect(formatHintRef("front")).toBe("[front]");
    expect(formatHintRefList(["sw1", "sw2"])).toBe("[sw1], [sw2]");
  });
});

describe("buildHintRefCatalog", () => {
  it("maps component ids to the whole component and loads to signal terminals", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(catalog.chime).toEqual({ componentId: "chime" });
    expect(catalog.buttonFront).toEqual({ componentId: "buttonFront" });
    expect(catalog.front).toEqual({ componentId: "chime", terminalId: "front" });
    expect(catalog.rear).toEqual({ componentId: "chime", terminalId: "rear" });
  });

  it("maps unique terminal ids from grading endpoints (e.g. trans)", () => {
    const catalog = buildHintRefCatalog({
      ...doorbellConfig(),
      grading: {
        continuity: [
          {
            from: { component: "transformer", terminal: "sec-hot" },
            to: { component: "chime", terminal: "trans" },
          },
        ],
      },
    });
    expect(catalog.trans).toEqual({ componentId: "chime", terminalId: "trans" });
    expect(catalog["chime.trans"]).toEqual({
      componentId: "chime",
      terminalId: "trans",
    });
    expect(catalog["transformer.sec-hot"]).toEqual({
      componentId: "transformer",
      terminalId: "sec-hot",
    });
  });

  it("does not add bare terminal ids that appear on multiple components", () => {
    const catalog = buildHintRefCatalog({
      components: [{ id: "lampA" }, { id: "lampB" }],
      simulation: {
        supply: {
          hot: { component: "lampA", terminal: "hot" },
          return: { component: "lampA", terminal: "n" },
        },
        loads: [
          {
            id: "a",
            requireHot: { component: "lampA", terminal: "hot" },
            signal: { component: "lampA", terminal: "n" },
          },
          {
            id: "b",
            requireHot: { component: "lampB", terminal: "hot" },
            signal: { component: "lampB", terminal: "n" },
          },
        ],
      },
    });
    expect(catalog.hot).toBeUndefined();
    expect(catalog["lampA.hot"]).toEqual({
      componentId: "lampA",
      terminalId: "hot",
    });
  });

  it("keeps a load id that equals a component id as the component mapping", () => {
    const catalog = buildHintRefCatalog({
      components: [{ id: "lamp" }, { id: "power" }],
      simulation: {
        loads: [
          {
            id: "lamp",
            requireHot: { component: "lamp", terminal: "hot" },
            signal: { component: "lamp", terminal: "hot" },
          },
        ],
      },
    });
    expect(catalog.lamp).toEqual({ componentId: "lamp" });
  });
});

describe("resolveHintRef", () => {
  it("strips brackets and resolves known tokens", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(resolveHintRef("[front]", catalog)).toEqual({
      display: "front",
      componentId: "chime",
      terminalId: "front",
    });
    expect(resolveHintRef("buttonFront", catalog)).toEqual({
      display: "buttonFront",
      componentId: "buttonFront",
      terminalId: undefined,
    });
  });

  it("returns null for unknown tokens", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(resolveHintRef("[unknown]", catalog)).toBeNull();
    expect(resolveHintRef("nope", catalog)).toBeNull();
  });
});

describe("linkifyHintText", () => {
  it("linkifies only bracketed catalog tokens", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    const segments = linkifyHintText(
      "Closing [buttonFront] does not energize [front].",
      catalog
    );
    expect(segments).toEqual([
      { type: "text", value: "Closing " },
      {
        type: "ref",
        value: "[buttonFront]",
        display: "buttonFront",
        componentId: "buttonFront",
      },
      { type: "text", value: " does not energize " },
      {
        type: "ref",
        value: "[front]",
        display: "front",
        componentId: "chime",
        terminalId: "front",
      },
      { type: "text", value: "." },
    ]);
  });

  it("leaves bare catalog ids as plain text", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(linkifyHintText("Closing buttonFront does not energize front.", catalog)).toEqual([
      { type: "text", value: "Closing buttonFront does not energize front." },
    ]);
  });

  it("leaves unknown bracket spans as plain text", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(linkifyHintText("See [unknown] next.", catalog)).toEqual([
      { type: "text", value: "See " },
      { type: "text", value: "[unknown]" },
      { type: "text", value: " next." },
    ]);
  });

  it("linkifies each id in a comma-separated bracket list", () => {
    const catalog = buildHintRefCatalog({
      components: [{ id: "sw1" }, { id: "sw2" }, { id: "lamp" }],
      simulation: {
        loads: [
          {
            id: "lamp",
            requireHot: { component: "lamp", terminal: "hot" },
            signal: { component: "lamp", terminal: "hot" },
          },
        ],
      },
    });
    const segments = linkifyHintText(
      "Closing [sw1], [sw2] does not energize [lamp].",
      catalog
    );
    expect(segments).toEqual([
      { type: "text", value: "Closing " },
      { type: "ref", value: "[sw1]", display: "sw1", componentId: "sw1" },
      { type: "text", value: ", " },
      { type: "ref", value: "[sw2]", display: "sw2", componentId: "sw2" },
      { type: "text", value: " does not energize " },
      { type: "ref", value: "[lamp]", display: "lamp", componentId: "lamp" },
      { type: "text", value: "." },
    ]);
  });

  it("leaves unrelated words alone", () => {
    const catalog = buildHintRefCatalog(doorbellConfig());
    expect(linkifyHintText("All good — keep wiring.", catalog)).toEqual([
      { type: "text", value: "All good — keep wiring." },
    ]);
  });
});
