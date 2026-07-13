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
