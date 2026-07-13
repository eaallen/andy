# Remote Electrician Lab

A web-based circuit lab for USU Eastern students preparing for the Utah state electrician certification exam. Students who cannot attend in-person lab sessions can still build, test, and submit circuit work remotely.

## The problem

Hands-on labs are a core part of the electrician prep course. Many students work full-time or are out of state when lab sessions run, so they miss the practice that matters most for the exam. This project brings that lab experience online: diagram circuits, wire them correctly, and get feedback on whether the build works.

## Goals

- Let remote students participate in the same lab exercises as students on campus
- Provide a visual circuit editor for placing and connecting electrical components
- Grade student work against a correct reference circuit
- Optionally simulate the circuit so students can verify behavior before submitting
- Support multiple exercises from lab files (YAML/JSON), starting with a doorbell system and a single-pole lamp circuit

## How labs work

Exercises are defined under [`public/labs/`](public/labs/). JavaScript owns component visuals and factories; each lab file owns layout, demo wires, continuity simulation, and Check grading. See the [lab authoring guide](public/labs/README.md) for the schema, component catalog, and checklist.

The app shell includes a lab picker (`?lab=doorbell` or `?lab=single-pole-lamp`).

### Modes

| Mode | What it does |
| --- | --- |
| **Demo** | Pre-wired reference circuit from the lab file. Press buttons / toggle switches to exercise simulation feedback. |
| **Lab** | Same components start unwired. Draw terminal-to-terminal wires, test continuity, then **Check** for pass/fail grading. |

## Included labs

### Doorbell system

Three doorbell buttons: **Front** plays one sound; **Rear** and **Side** share the other (typical residential wiring). Students place components, wire so Front has its own chime path and Rear/Side share Rear, then Check.

### Single-pole lamp

Power → SPST switch → lamp. Students wire 120V hot through the switch to the lamp and return neutral; the lamp lights only when the switch is closed.

## Core features

### Circuit editor (Konva)

The canvas is built with [Konva](https://konvajs.org/). Components are draggable groups with labeled terminals; wires connect terminal to terminal.

| Component type | Role |
| --- | --- |
| `power` | 120V supply (L1, N, G) |
| `transformer` | Steps 120V down to 24V |
| `chime` | Front, Trans, Rear terminals |
| `terminal-block` | Junction points for branching |
| `button` | Momentary contact when pressed |
| `switch` | SPST toggle (click to open/close) |
| `lamp` | Load with visual on/off |
| Wire | Terminal-to-terminal (red / gray / blue / green); double-click to add bends |

### Grading and simulation (from lab config)

**Check** and continuity simulation read `grading` and `simulation` from the lab file — not hardcoded component ids. Changing expectations or load mapping is a lab-file edit. Details: [public/labs/README.md](public/labs/README.md).

## Tech stack

- **HTML / CSS / JavaScript** — app shell and lab logic
- **[Vite](https://vitejs.dev/)** — local dev server and production build
- **[Vitest](https://vitest.dev/)** — unit tests for lab config, circuit, and grading
- **[js-yaml](https://github.com/nodeca/js-yaml)** — parses YAML and JSON lab definitions
- **[Konva](https://konvajs.org/)** — 2D canvas for components, wires, and interaction
- **Web Audio API** — sound profiles from lab config (no sound files)

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Use the Lab picker to switch exercises.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build a production bundle into `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Re-run tests on file changes |

## Project status

**Configurable multi-lab engine** — Demo/Lab/Check/Test driven by YAML (or JSON) under `public/labs/`. Doorbell and single-pole lamp labs ship as examples; new exercises using existing component types need only a lab file.

Next steps toward a fuller remote lab:

1. More Utah exam–style exercises (3-way, 4-way, GFCI, etc.) using the existing types where possible
2. Richer grading feedback and instructor review
3. Optional short-circuit / open-circuit diagnostics
4. Student submit / persistence (backend)

## Audience

- **Students** — remote or in-person learners practicing residential wiring for the state exam
- **Instructor** — USU Eastern faculty assigning labs and reviewing graded results
- **Authors / AI** — draft new labs from the [authoring guide](public/labs/README.md) without changing core JS when types already exist
