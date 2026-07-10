# Remote Electrician Lab

A web-based circuit lab for USU Eastern students preparing for the Utah state electrician certification exam. Students who cannot attend in-person lab sessions can still build, test, and submit circuit work remotely.

## The problem

Hands-on labs are a core part of the electrician prep course. Many students work full-time or are out of state when lab sessions run, so they miss the practice that matters most for the exam. This project brings that lab experience online: diagram circuits, wire them correctly, and get feedback on whether the build works.

## Goals

- Let remote students participate in the same lab exercises as students on campus
- Provide a visual circuit editor for placing and connecting electrical components
- Grade student work against a correct reference circuit
- Optionally simulate the circuit so students can verify behavior before submitting
- Ship a concrete demo lab: a multi-doorbell system (Front vs shared Rear/Side sounds)

## Demo lab: doorbell system

The first exercise is a doorbell circuit with **three doorbell buttons**. **Front** plays one sound; **Rear** and **Side** share the other (typical residential wiring). Students must:

1. Place the required components (power source, doorbells/buttons, chimes or sound devices, wiring)
2. Wire the circuit so Front triggers its own sound and Rear/Side share the Rear chime path
3. Test the circuit (via simulation or graded checks)
4. Submit for grading

This exercise covers switches, parallel/branch wiring, and verifying that each input maps to the correct output — skills that transfer to other residential wiring labs.

### Modes

| Mode | What it does |
| --- | --- |
| **Demo** | Pre-wired reference circuit matching a residential doorbell schematic. Press Front for one tone; Rear and Side share the other. |
| **Lab** | Same components start unwired. Draw terminal-to-terminal wires, press buttons to test continuity, then **Check** for pass/fail grading. |

### Diagram note

The layout follows a hand-drawn residential doorbell schematic (power → terminal block → transformer → chime + three buttons). Rear and Side both land on the **Rear** chime terminal.

## Core features

### Circuit editor (Konva)

The canvas is built with [Konva](https://konvajs.org/). Components are draggable groups with labeled terminals; wires connect terminal to terminal.

| Component | Role |
| --- | --- |
| Power source | 120V supply (L1, N, G) |
| Wire | Connects terminals (red / gray / blue / green); double-click to add bends |
| Switch / doorbell button | Momentary contact when pressed |
| Chime | Front, Trans, and Rear terminals; Rear is shared by Rear and Side buttons |
| Terminal block | Junction points for branching wires |
| Transformer | Steps 120V down to 24V for the chime circuit |

### Grading (Lab mode)

**Check** compares behavior to the expected solution:

- Are all required components present?
- Is chime Trans powered from the transformer 24V hot?
- Does Front energize only the Front chime path?
- Do Rear and Side each energize only the Rear chime path (shared)?

### Circuit simulation

On button press, the lab traces continuity through wires and the closed switch:

- Transformer 24V hot → chime Trans, and return through the pressed button to 24V common
- Matching chime tone plays; live terminals highlight briefly
- **Test** runs Front → Rear → Side in sequence

## Tech stack

- **HTML / CSS / JavaScript** — app shell and lab logic
- **[Konva](https://konvajs.org/)** — 2D canvas for components, wires, and interaction
- **Web Audio API** — Front ding-dong and shared Rear/Side tone (no sound files)

## Getting started

Open the app locally (no build step):

```bash
# from the project root — any static server works, e.g.:
npx serve .
# or open index.html directly in a browser
```

Then open the served URL (or `index.html`) in a browser.

## Project status

**Doorbell demo lab** — Konva circuit editor with Demo and Lab modes, terminal-based wiring, continuity simulation, two chime sounds (Front vs shared Rear/Side), and simple Lab grading.

Next steps toward a fuller remote lab:

1. More lab exercises beyond the doorbell circuit
2. Richer grading feedback and instructor review
3. Optional short-circuit / open-circuit diagnostics
4. Student submit / persistence (backend)

## Audience

- **Students** — remote or in-person learners practicing residential wiring for the state exam
- **Instructor** — USU Eastern faculty assigning labs and reviewing graded results
