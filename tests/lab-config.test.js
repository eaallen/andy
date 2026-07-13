import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeLabConfig,
  parseLabSource,
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
        hot: { component: "transformer", terminal: "sec-hot" },
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
      { switch: "buttonFront", energize: ["front"] },
      { switch: "buttonRear", energize: ["rear"] },
      { switch: "buttonSide", energize: ["rear"] },
    ]);
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
