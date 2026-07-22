# Lab authoring guide

Lab exercises are YAML or JSON files in this folder. JavaScript owns the visual component factories (`power`, `button`, `lamp`, …). Lab files own placement, demo wiring, simulation topology, and grading rules.

**New device kinds** still need a factory under `js/components/` (registered in `registry.js`). **New exercises** that only use existing kinds need only a lab file.

## Loading a lab

- Inline embed (CDN / host pages): a `<pre class="circuit-lab"><code>…YAML…</code></pre>` block; load `andy.js` (or the module) so it scans and mounts
- Optional `width` / `height` attributes on the `<pre>` (CSS sizes or bare pixel numbers)
- The app shell (`index.html`) fetches a lab file, injects it into that markup, then mounts via `?lab=<id>`

Both YAML and JSON go through the same `js-yaml` parser (JSON is a subset of YAML 1.2).

## Schema reference

Top-level fields:

| Field | Required | Description |
| --- | --- | --- |
| `title` | yes | Lab title shown in the UI |
| `margin` | no | Stage margin in px (default applied by loader) |
| `passMessage` | no | Message when Check passes |
| `hints.demo` / `hints.lab` | no | Mode hint text |
| `defaultWireColor` | no | Starting / remembered wire color for new wires (default `black`) |
| `wireColors` | no | Colors shown in the wire picker (default: full palette) |
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

Demo wire colors (and picker keys): `black`, `white`, `red`, `blue`, `yellow`, `orange`, `green`, `purple`, plus legacy `gray`.

Lab mode remembers the last color the student picks for all new wires (it does **not** auto-match the terminal). Configure the starting color and picker list:

```yaml
defaultWireColor: black
wireColors: [black, white, red, blue, yellow, orange, green, purple]
```

Omit both fields to use the defaults above. `defaultWireColor` must be one of the keys in `wireColors` (or the default palette when `wireColors` is omitted).

### Simulation

A load is energized when one of its terminals can reach `supply.hot` **and** the other can reach `supply.return`, through wires plus closed-switch bridges — **either polarity lights the load** (like a real lamp). Use `grading.polarity` (or terminal-specific `continuity`) to require labeled hot/neutral orientation.

```yaml
simulation:
  supply:
    hot: power.l1              # or [power.l1, power.l2] for multi-wire
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
| `button` | `com` ↔ `sig` (only while pressed) |
| `switch` | `com` ↔ `no` (only when closed) |
| `three-way` | Always: `com` ↔ `t1` (open) or `com` ↔ `t2` (closed) |
| `four-way` | Always: straight `a1↔b1`,`a2↔b2` or cross `a1↔b2`,`a2↔b1` |
| `gfci` | Always: LINE ↔ LOAD for hot, N, and G (device not tripped) |

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
  polarity:                    # labeled orientation; load may still light if reversed
    - load: lamp
      closed: [switch1]        # optional; switches closed for the check (default [])
      fail: "Lamp hot and neutral are reversed."
  whenClosed:                  # close named switch(es); exactly these loads must be live
    - switch: switch1          # legacy single-switch form
      energize: [lamp]
    # Multi-switch / default throw (3-way, 4-way, always-on loads):
    # - closed: []             # all open / default throw
    #   energize: [lamp]
    # - closed: [sw1, sw2]
    #   energize: []
```

`whenClosed` requires a `simulation` block so `energize` ids can be validated. Use `closed: []` when loads should be live with no switches thrown (GFCI, multi-wire). `polarity` checks that `requireHot` reaches supply hot and `signal` reaches supply return (oriented); visual energize stays polarity-agnostic.
## Built-in component catalog

Factories live under `js/components/` (`COMPONENT_REGISTRY` in `registry.js`). Use these `type` strings in lab files.

### `power`

120V AC supply by default (`l1`, `n`, `g`). Set `legs` to add more hot terminals (`l2`, `l3`, …) for multi-wire / multi-phase feeds. Set `kind: dc` for the DC voltage-source icon (circle with +/−); default `kind: ac` is the circle with a sine wave.

```yaml
- id: power
  type: power
  legs: 2          # optional; default 1 → terminals l1, n, g
  kind: ac         # optional; ac (default) or dc
```

| Terminal id | Label | Typical role |
| --- | --- | --- |
| `l1` … `lN` | L1 … LN | Hot legs (`legs` count, default 1) |
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

### `three-way` (alias: `threeWay`)

SPDT 3-way switch. Always bridges COM to one traveler: open → `t1`, closed → `t2`.

| Terminal id | Label |
| --- | --- |
| `t1` | T1 |
| `com` | COM |
| `t2` | T2 |

### `four-way` (alias: `fourWay`)

4-way traveler switch between two 3-ways. Open = straight (`a1↔b1`, `a2↔b2`); closed = cross (`a1↔b2`, `a2↔b1`).

| Terminal id | Label |
| --- | --- |
| `a1` | A1 |
| `a2` | A2 |
| `b1` | B1 |
| `b2` | B2 |

### `lamp`

Load with visual on/off from `feedback: { type: light }`.

| Terminal id | Label |
| --- | --- |
| `hot` | Hot |
| `n` | N |

### `receptacle`

Duplex receptacle (shared hot/neutral/ground screws).

| Terminal id | Label |
| --- | --- |
| `hot` | Hot |
| `n` | N |
| `g` | G |

### `gfci`

GFCI receptacle with LINE and LOAD. LINE always bridges to LOAD for continuity labs (device not tripped).

| Terminal id | Label | Side |
| --- | --- | --- |
| `line-hot` | Hot | LINE |
| `line-n` | N | LINE |
| `line-g` | G | LINE |
| `load-hot` | Hot | LOAD |
| `load-n` | N | LOAD |
| `load-g` | G | LOAD |

## Example labs

### Doorbell (`doorbell.yaml`)

Three buttons, transformer, chime. Front plays `dingDong`; Rear and Side share Rear (`buzz`). Simulation supply is transformer 24V; grading checks Trans continuity and exclusive Front vs Rear energization.

### Single-pole lamp (`single-pole-lamp.yaml`)

Power → SPST `switch` → `lamp`. Supply is `power.l1` / `power.n`. Lamp feedback is `light`. Check requires hot through the switch and neutral return; lamp must energize only when the switch is closed.

### Three-way lamp (`three-way-lamp.yaml`)

Two `three-way` switches and a lamp. Travelers T1/T2 between switches; lamp on when both select the same traveler. Grading uses `closed: []` / `[sw1]` / `[sw2]` / `[sw1, sw2]`.

### Four-way lamp (`four-way-lamp.yaml`)

Two 3-ways with a `four-way` in the traveler path. Any switch can toggle the lamp.

### GFCI downstream (`gfci-downstream.yaml`)

Power → GFCI LINE; LOAD feeds a downstream `receptacle`. Check verifies LINE/LOAD wiring and that the receptacle is energized through internal bridges.

### Multi-wire branch (`multi-wire-branch.yaml`)

`supply.hot: [power.l1, power.l2]` feeds two lamps on a shared neutral.
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
