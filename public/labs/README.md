# Lab authoring guide

Lab exercises are YAML or JSON files in this folder. JavaScript owns the visual component factories (`power`, `button`, `lamp`, …). Lab files own placement, demo wiring, simulation topology, and grading rules.

**New device kinds** still need a factory in `js/components.js`. **New exercises** that only use existing kinds need only a lab file.

## Loading a lab

- File URL: `<circuit-lab src="labs/doorbell.yaml">` (or `.yml` / `.json`)
- Inline: a `<script type="text/yaml">` or `type="application/json"` child of `<circuit-lab>`
- The app shell (`index.html`) lists labs and loads via `?lab=<id>`

Both YAML and JSON go through the same `js-yaml` parser (JSON is a subset of YAML 1.2).

## Schema reference

Top-level fields:

| Field | Required | Description |
| --- | --- | --- |
| `title` | yes | Lab title shown in the UI |
| `margin` | no | Stage margin in px (default applied by loader) |
| `passMessage` | no | Message when Check passes |
| `hints.demo` / `hints.lab` | no | Mode hint text |
| `components` | yes | Layout entries (see below) |
| `demo.wires` | no | Pre-wires for Demo mode; Lab mode starts empty |
| `simulation` | no\* | Continuity / energization model |
| `grading` | no\* | Check rules |

\*Needed for interactive simulation and Check grading. Omit only for layout-only drafts.

### Components

```yaml
components:
  - id: switch1          # unique id used in wires, simulation, grading
    type: switch         # registry type (see catalog)
    label: Switch        # optional display label (button / switch / lamp)
    x: center-55         # number, percent, or expression
    y: center-44
```

**Coordinates** (`x` / `y`):

- Numbers: `40`, `"40"`
- Percents: `"42%"`
- Keywords: `margin`, `left`, `top`, `center`, `right`, `bottom`
- Offsets: `center-140`, `right-190`, `bottom-128`, `center+64`

### Wire endpoints

Every endpoint is `"componentId.terminalId"` (e.g. `power.l1`, `chime.trans`).

```yaml
demo:
  wires:
    - { from: power.l1, to: switch1.com, color: blue }
    # or short form: [power.l1, switch1.com, blue]
```

Wire colors: `red`, `gray`, `blue`, `green`.

### Simulation

A load is energized when `requireHot` can reach `supply.hot` **and** `signal` can reach `supply.return`, through wires plus closed-switch bridges.

```yaml
simulation:
  supply:
    hot: power.l1              # "component.terminal"
    return: power.n
  loads:
    - id: lamp                 # used by grading.whenClosed.energize
      requireHot: lamp.hot
      signal: lamp.n
      feedback: { type: light } # or { type: sound, profile: dingDong }
  # Optional — only if default bridges are wrong for a switch:
  # switches:
  #   - id: switch1
  #     bridges: [[com, no]]
```

**Feedback**

| `type` | Behavior |
| --- | --- |
| `sound` | Plays `profile` when the load is live (`dingDong`, `buzz`) |
| `light` | Lights a `lamp` component when the load is live (no sound) |

**Default switch bridges** (when closed; override with `simulation.switches`):

| Component type | Bridge |
| --- | --- |
| `button` | `com` ↔ `sig` |
| `switch` | `com` ↔ `no` |

### Grading

```yaml
grading:
  required:                    # component ids that must be on the stage
    - power
    - switch1
    - lamp
  continuity:                  # wires only (no switch bridges)
    - from: power.l1
      to: switch1.com
      fail: "Power L1 is not wired to the switch COM."
  whenClosed:                  # close named switch; exactly these loads must be live
    - switch: switch1
      energize: [lamp]
```

`whenClosed` requires a `simulation` block so `energize` ids can be validated.

## Built-in component catalog

Factories live in `js/components.js` (`COMPONENT_REGISTRY`). Use these `type` strings in lab files.

### `power`

120V supply.

| Terminal id | Label | Typical role |
| --- | --- | --- |
| `l1` | L1 | Hot |
| `n` | N | Neutral |
| `g` | G | Ground |

### `transformer`

Steps 120V down to 24V.

| Terminal id | Label | Side |
| --- | --- | --- |
| `pri-l1` | L1 | Primary |
| `pri-n` | N | Primary |
| `pri-g` | G | Primary |
| `sec-hot` | 24V | Secondary hot |
| `sec-com` | COM | Secondary common |

### `chime`

Doorbell chime (Front / Trans / Rear). Rear is typically shared by Rear and Side buttons.

| Terminal id | Label |
| --- | --- |
| `front` | Front |
| `trans` | Trans |
| `rear` | Rear |

### `terminal-block` (alias: `terminalBlock`)

Junction block for branching.

| Terminal id | Label |
| --- | --- |
| `l1` | L1 |
| `n` | N |
| `g` | G |
| `com` | COM |
| `sig-f` | F |
| `sig-r` | R |
| `sig-s` | S |

### `button`

Momentary doorbell button. Hold/press closes; bridges `com` ↔ `sig` while pressed. `label` sets the visible name (e.g. Front, Rear, Side).

| Terminal id | Label |
| --- | --- |
| `com` | COM |
| `sig` | SIG |

### `switch`

SPST toggle. Click toggles open/closed; when closed, bridges `com` ↔ `no`.

| Terminal id | Label |
| --- | --- |
| `com` | COM |
| `no` | NO |

### `lamp`

Load with visual on/off from `feedback: { type: light }`.

| Terminal id | Label |
| --- | --- |
| `hot` | Hot |
| `n` | N |

## Example labs

### Doorbell (`doorbell.yaml`)

Three buttons, transformer, chime. Front plays `dingDong`; Rear and Side share Rear (`buzz`). Simulation supply is transformer 24V; grading checks Trans continuity and exclusive Front vs Rear energization.

### Single-pole lamp (`single-pole-lamp.yaml`)

Power → SPST `switch` → `lamp`. Supply is `power.l1` / `power.n`. Lamp feedback is `light`. Check requires hot through the switch and neutral return; lamp must energize only when the switch is closed.

## Authoring checklist (for humans and AI)

1. Give every component a **unique `id`**.
2. Use only **catalog `type` values** (or add a factory first).
3. Every wire / supply / load / continuity endpoint must be a valid **`componentId.terminalId`** for that type.
4. Declare **one `simulation.supply`** and a non-empty **`loads`** list when you need sim or Check.
5. Align **`grading.whenClosed.energize`** ids with **`simulation.loads[].id`**.
6. Align **`grading.required`** with **`components[].id`**.
7. Prefer **default bridges**; add `simulation.switches` only when a device does not use the defaults above.
8. Set **`feedback.type`**: `sound` + `profile` for chimes; `light` for lamps.
9. Put demo wires under **`demo.wires`**; Lab mode ignores them and starts unwired.
10. After editing, run **`npm test`** and smoke the lab in Demo / Lab / Check / Test.

## Out of scope for lab files

- New geometric drawings or terminal layouts (needs JS)
- True electrical physics (voltage drop, shorts as physics)
- Formal JSON Schema / CI validator package
