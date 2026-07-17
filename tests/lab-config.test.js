import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadLabConfigFromPre,
  normalizeLabConfig,
  parseLabSource,
  readLabSourceFromPre,
} from "../js/lab-config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("lab config parsing", () => {
  it("parses JSON lab definitions", () => {
    const raw = parseLabSource(
      JSON.stringify({
        title: "JSON Lab",
        components: [{ id: "power", type: "power", x: 0, y: 0 }],
      }),
      "json"
    );

    const config = normalizeLabConfig(raw);
    expect(config.title).toBe("JSON Lab");
    expect(config.components).toHaveLength(1);
    expect(config.components[0].id).toBe("power");
  });

  it("rejects empty lab definitions", () => {
    expect(() => parseLabSource("   ", "yaml")).toThrow(/empty/i);
  });

  it("loads and normalizes the doorbell demo lab", () => {
    const yaml = readFileSync(join(root, "public/labs/doorbell.yaml"), "utf8");
    const config = normalizeLabConfig(parseLabSource(yaml, "yaml"));

    expect(config.title).toBe("Doorbell Demo Lab");
    expect(config.components.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "power",
        "transformer",
        "chime",
        "terminalBlock",
        "buttonFront",
        "buttonRear",
        "buttonSide",
      ])
    );
    expect(config.demoWires.length).toBeGreaterThan(0);
    expect(config.demoWires[0]).toMatchObject({
      from: expect.objectContaining({ component: expect.any(String) }),
      to: expect.objectContaining({ component: expect.any(String) }),
      color: expect.any(String),
    });
    expect(config.simulation).toMatchObject({
      supply: {
        hot: [{ component: "transformer", terminal: "sec-hot" }],
        return: { component: "transformer", terminal: "sec-com" },
      },
    });
    expect(config.simulation.loads).toEqual([
      {
        id: "front",
        requireHot: { component: "chime", terminal: "trans" },
        signal: { component: "chime", terminal: "front" },
        feedback: { type: "sound", profile: "dingDong" },
      },
      {
        id: "rear",
        requireHot: { component: "chime", terminal: "trans" },
        signal: { component: "chime", terminal: "rear" },
        feedback: { type: "sound", profile: "buzz" },
      },
    ]);
    expect(config.grading.required).toEqual([
      "power",
      "transformer",
      "chime",
      "terminalBlock",
      "buttonFront",
      "buttonRear",
      "buttonSide",
    ]);
    expect(config.grading.continuity).toEqual([
      {
        from: { component: "transformer", terminal: "sec-hot" },
        to: { component: "chime", terminal: "trans" },
        fail: "Chime Trans is not powered from the transformer 24V hot.",
      },
    ]);
    expect(config.grading.whenClosed).toEqual([
      { switch: "buttonFront", closed: ["buttonFront"], energize: ["front"] },
      { switch: "buttonRear", closed: ["buttonRear"], energize: ["rear"] },
      { switch: "buttonSide", closed: ["buttonSide"], energize: ["rear"] },
    ]);
  });

  it("loads and normalizes the three-way lamp lab", () => {
    const yaml = readFileSync(join(root, "public/labs/three-way-lamp.yaml"), "utf8");
    const config = normalizeLabConfig(parseLabSource(yaml, "yaml"));

    expect(config.title).toBe("Three-Way Lamp Lab");
    expect(config.components.map((c) => c.type)).toEqual(
      expect.arrayContaining(["power", "three-way", "lamp"])
    );
    expect(config.grading.whenClosed[0]).toEqual({
      closed: [],
      energize: ["lamp"],
    });
    expect(config.grading.whenClosed[3]).toEqual({
      closed: ["sw1", "sw2"],
      energize: ["lamp"],
    });
  });

  it("loads multi-wire branch with multiple supply hots", () => {
    const yaml = readFileSync(join(root, "public/labs/multi-wire-branch.yaml"), "utf8");
    const config = normalizeLabConfig(parseLabSource(yaml, "yaml"));

    expect(config.components.find((c) => c.id === "power").legs).toBe(2);
    expect(config.simulation.supply.hot).toEqual([
      { component: "power", terminal: "l1" },
      { component: "power", terminal: "l2" },
    ]);
    expect(config.grading.whenClosed[0].energize).toEqual(["lampA", "lampB"]);
  });

  it("defaults power legs to 1 and rejects invalid legs", () => {
    const oneLeg = normalizeLabConfig({
      components: [{ id: "power", type: "power", x: 0, y: 0 }],
    });
    expect(oneLeg.components[0].legs).toBe(1);

    expect(() =>
      normalizeLabConfig({
        components: [{ id: "power", type: "power", legs: 0, x: 0, y: 0 }],
      })
    ).toThrow(/legs must be an integer from 1 to 4/i);

    expect(() =>
      normalizeLabConfig({
        components: [{ id: "lamp", type: "lamp", legs: 2, x: 0, y: 0 }],
      })
    ).toThrow(/only type "power" supports legs/i);
  });

  it("rejects demo wires that reference unknown components", () => {
    const raw = {
      components: [{ id: "power", type: "power", x: 0, y: 0 }],
      demo: {
        wires: [["power.l1", "missing.hot"]],
      },
    };

    expect(() => normalizeLabConfig(raw)).toThrow(/unknown component/i);
  });
});

describe("loadLabConfigFromPre", () => {
  it("reads YAML from a nested code element", () => {
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = [
      "title: Pre Lab",
      "components:",
      "  - { id: power, type: power, x: 0, y: 0 }",
    ].join("\n");
    pre.appendChild(code);

    expect(readLabSourceFromPre(pre)).toContain("title: Pre Lab");
    const config = loadLabConfigFromPre(pre);
    expect(config.title).toBe("Pre Lab");
    expect(config.components[0].id).toBe("power");
  });

  it("falls back to the pre textContent when there is no code child", () => {
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    pre.textContent = JSON.stringify({
      title: "Bare Pre",
      components: [{ id: "power", type: "power", x: 0, y: 0 }],
    });

    const config = loadLabConfigFromPre(pre);
    expect(config.title).toBe("Bare Pre");
  });

  it("rejects empty pre.circuit-lab blocks", () => {
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = "  \n  ";
    pre.appendChild(code);

    expect(() => loadLabConfigFromPre(pre)).toThrow(/inline YAML/i);
  });
});
