/**
 * Component catalog + authoring rules embedded in the AI prompt.
 * Keep in sync with frontend/public/labs/README.md and js/components/.
 */

export const COMPONENT_CATALOG = `
## Built-in component types and terminals

### power
- Terminals: l1…lN (hot legs), n (neutral), g (ground)
- Optional field: legs (number, default 1). legs: 2 adds l2, etc.
- Optional field: kind (ac|dc, default ac). Icon only — ac = circle+sine, dc = circle+/−.

### transformer
- Terminals: pri-l1, pri-n, pri-g, sec-hot, sec-com

### chime
- Terminals: front, trans, rear

### terminal-block (alias terminalBlock)
- Terminals: l1, n, g, com, sig-f, sig-r, sig-s

### button
- Terminals: com, sig
- Momentary; bridges com↔sig while pressed. Use label for Front/Rear/Side.

### switch
- Terminals: com, no
- SPST; when closed bridges com↔no.

### three-way (alias threeWay)
- Terminals: t1, com, t2
- Always bridges com↔t1 (open) or com↔t2 (closed).

### four-way (alias fourWay)
- Terminals: a1, a2, b1, b2
- Open = straight a1↔b1, a2↔b2; closed = cross a1↔b2, a2↔b1.

### lamp
- Terminals: hot, n

### receptacle
- Terminals: hot, n, g

### gfci
- Terminals: line-hot, line-n, line-g, load-hot, load-n, load-g
- LINE always bridges to LOAD in this lab tool (device not tripped).
`.trim();

export const LAB_YAML_SCHEMA_RULES = `
## Andy lab YAML schema (required output format)

Top-level fields:
- title: string (required)
- margin: number (optional, default 40)
- passMessage: string (optional)
- hints.demo / hints.lab: strings (optional)
- defaultWireColor: color key (optional, default black) — starting color for new lab wires
- wireColors: array of color keys (optional) — colors shown in the wire picker
- components: array (required)
- demo.wires: array (optional but preferred when wiring is visible)
- simulation: object (include when loads/switches are present)
- grading: object (include when student Check should work)

### components[]
Each entry:
  id: unique string
  type: one of the catalog types above
  label: optional display string
  x, y: number | percent ("42%") | keyword expression
       keywords: margin, left, top, center, right, bottom
       offsets: center-55, right-140, bottom-128, center+64
  legs: only for power
  kind: only for power (ac|dc, default ac)

### Wire endpoints
Always "componentId.terminalId" (e.g. power.l1, switch1.com, lamp.hot).
Wire colors: black | white | red | blue | yellow | orange | green | purple | gray
  - black ≈ hot/line often
  - white / gray ≈ neutral
  - green ≈ ground
  - red ≈ switched/signal/traveler (use judgment from diagram)
  - blue / yellow / orange / purple ≈ travelers or distinct circuits

Optional lab wire-picker settings:
  defaultWireColor: black
  wireColors: [black, white, red, blue, yellow, orange, green, purple]

demo.wires item shapes:
  - { from: power.l1, to: switch1.com, color: blue }
  - or [power.l1, switch1.com, blue]

### simulation
supply:
  hot: power.l1   # or [power.l1, power.l2] for multi-wire
  return: power.n
loads:
  - id: lamp                 # must match a component id used in grading.whenClosed.energize
    requireHot: lamp.hot
    signal: lamp.n
    feedback: { type: light }  # or { type: sound, profile: dingDong|buzz }

### grading
required: [component ids that must exist]
continuity: [{ from, to, fail?: message }]  # wires only, no switch bridges
polarity: [{ load, closed?: [switch ids], fail?: message }]  # labeled hot/neutral; load still lights if reversed
whenClosed:
  - switch: switch1          # legacy single-switch form
    energize: [lamp]
  # or multi-switch:
  # - closed: []
  #   energize: [lamp]
  # - closed: [sw1, sw2]
  #   energize: []

## Authoring checklist
1. Unique component ids.
2. Only catalog types.
3. Every endpoint is valid componentId.terminalId for that type.
4. One simulation.supply + loads when sim/Check is needed.
5. grading.whenClosed.energize ids ⊆ simulation.loads[].id
6. grading.required ⊆ components[].id
7. Prefer default switch bridges; only override via simulation.switches when needed.
8. feedback.type sound+profile for chimes; light for lamps.
9. Put visible wiring under demo.wires.
`.trim();

export function buildLabYamlPrompt(options: {
  title?: string;
  notes?: string;
}): string {
  const titleLine = options.title
    ? `Preferred lab title: ${options.title}`
    : "Invent a clear, short lab title from the diagram.";
  const notesBlock = options.notes?.trim()
    ? `Instructor notes:\n${options.notes.trim()}`
    : "No extra instructor notes.";

  return `
You are an expert residential-wiring lab author for the Andy circuit lab tool
(USU Eastern electrician exam prep).

Your job: look at the attached image of a wiring diagram (hand-drawn or machine-drawn)
and produce a COMPLETE Andy lab YAML file that students can open in Andy to practice.

${titleLine}
${notesBlock}

${LAB_YAML_SCHEMA_RULES}

${COMPONENT_CATALOG}

## Layout guidance
- Place power on the left (x: margin), loads on the right (x: right-140 or similar).
- Switches/buttons in the middle (x: center-…).
- Vertically space stacked devices with center+/- offsets so they do not overlap.
- Prefer keyword coordinates over raw pixels so the lab scales.

## Output rules (critical)
1. Respond with ONLY a single YAML document. No markdown fences. No commentary.
2. Do not invent component types outside the catalog.
3. Infer reasonable demo wires, simulation, and grading from the diagram.
4. If the image is unclear, make the best conservative residential-wiring interpretation
   and still emit valid YAML (prefer a working single-pole lamp or doorbell pattern
   over an invalid file).
5. YAML must parse with js-yaml (YAML 1.2). Use plain ASCII quotes in fail messages.
`.trim();
}
