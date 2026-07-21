import { describe, expect, it } from "vitest";
import {
  extractYamlDocument,
  validateLabYaml,
} from "../src/lab/validate.js";

const SAMPLE = `
title: Single-Pole Lamp Lab
components:
  - id: power
    type: power
    x: margin
    y: center-44
  - id: switch1
    type: switch
    label: Switch
    x: center-55
    y: center-44
  - id: lamp
    type: lamp
    x: right-140
    y: center-48
simulation:
  supply:
    hot: power.l1
    return: power.n
  loads:
    - id: lamp
      requireHot: lamp.hot
      signal: lamp.n
      feedback: { type: light }
grading:
  required: [power, switch1, lamp]
  continuity:
    - from: power.l1
      to: switch1.com
  whenClosed:
    - switch: switch1
      energize: [lamp]
demo:
  wires:
    - { from: power.l1, to: switch1.com, color: blue }
    - { from: switch1.no, to: lamp.hot, color: red }
    - { from: lamp.n, to: power.n, color: gray }
`.trim();

describe("extractYamlDocument", () => {
  it("strips markdown fences", () => {
    const raw = "Here you go:\\n```yaml\\n" + SAMPLE + "\\n```\\n";
    // Use real newlines
    const fenced = `Here you go:\n\`\`\`yaml\n${SAMPLE}\n\`\`\`\n`;
    const extracted = extractYamlDocument(fenced);
    expect(extracted.startsWith("title:")).toBe(true);
    expect(extracted.includes("```")).toBe(false);
    void raw;
  });

  it("finds title: after prose", () => {
    const extracted = extractYamlDocument(`Sure!\n\n${SAMPLE}`);
    expect(extracted.startsWith("title:")).toBe(true);
  });
});

describe("validateLabYaml", () => {
  it("accepts a known-good single-pole lab", () => {
    const result = validateLabYaml(SAMPLE);
    expect(result.lab.title).toBe("Single-Pole Lamp Lab");
    expect(result.lab.components).toHaveLength(3);
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("rejects unknown component types", () => {
    const bad = SAMPLE.replace("type: switch", "type: contactor");
    expect(() => validateLabYaml(bad)).toThrow(/Unknown component type/);
  });

  it("rejects duplicate ids", () => {
    const bad = SAMPLE.replace(
      "id: lamp\n    type: lamp",
      "id: switch1\n    type: lamp",
    );
    expect(() => validateLabYaml(bad)).toThrow(/Duplicate component id/);
  });

  it("warns when simulation is missing", () => {
    const minimal = `
title: Layout Only
components:
  - id: power
    type: power
    x: margin
    y: center
`.trim();
    const result = validateLabYaml(minimal);
    expect(result.issues.some((i) => /simulation/i.test(i.message))).toBe(true);
  });
});
