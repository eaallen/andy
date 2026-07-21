import type {
  DiagramAiProvider,
  DiagramGenerationRequest,
  DiagramGenerationResult,
} from "@/ai/types.js";

/**
 * Offline demo provider — returns a realistic single-pole lamp lab so the
 * author UI / video walkthrough works without CURSOR_API_KEY or GEMINI_API_KEY.
 *
 * Enable with AI_PROVIDER=demo.
 */
export class DemoDiagramProvider implements DiagramAiProvider {
  readonly name = "demo" as const;

  async generateLabYaml(
    request: DiagramGenerationRequest,
  ): Promise<DiagramGenerationResult> {
    // Small delay so the UI "Generating…" state is visible in demos/videos.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const title =
      request.title?.trim() ||
      "Single-Pole Lamp Lab (from diagram image)";

    const notesHint = request.notes?.trim()
      ? `\n# Instructor notes considered: ${request.notes.trim().replace(/\n/g, " ")}`
      : "";

    const yaml = `title: ${JSON.stringify(title).slice(1, -1)}
margin: 40
passMessage: Pass — the lamp lights only when the switch is closed.
hints:
  demo: >-
    Demo: click the switch to close it and light the lamp; click again to open
    and turn the lamp off.
  lab: >-
    Lab: wire 120V hot through the SPST switch to the lamp, and return neutral
    to power. Then Check to grade.
${notesHint}
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
    label: Lamp
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
  required:
    - power
    - switch1
    - lamp
  continuity:
    - from: power.l1
      to: switch1.com
      fail: "Power L1 is not wired to the switch COM."
    - from: switch1.no
      to: lamp.hot
      fail: "Switch NO is not wired to the lamp hot."
    - from: lamp.n
      to: power.n
      fail: "Lamp neutral is not wired to power neutral."
  whenClosed:
    - switch: switch1
      energize: [lamp]

demo:
  wires:
    - { from: power.l1, to: switch1.com, color: blue }
    - { from: switch1.no, to: lamp.hot, color: red }
    - { from: lamp.n, to: power.n, color: gray }
`;

    return {
      yaml,
      provider: "demo",
      model: "demo-fixture",
      rawText: yaml,
    };
  }
}
