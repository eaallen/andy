# Remote Electrician Lab

A web-based circuit lab for USU Eastern students preparing for the Utah state electrician certification exam. Students who cannot attend in-person lab sessions can still build, test, and submit circuit work remotely.

## The problem

Hands-on labs are a core part of the electrician prep course. Many students work full-time or are out of state when lab sessions run, so they miss the practice that matters most for the exam. This project brings that lab experience online: diagram circuits, wire them correctly, and get feedback on whether the build works.

## Goals

- Let remote students participate in the same lab exercises as students on campus
- Provide a visual circuit editor for placing and connecting electrical components
- Grade student work against a correct reference circuit
- Optionally simulate the circuit so students can verify behavior before submitting
- Ship a concrete demo lab: a multi-doorbell system with distinct sounds per button

## Demo lab: doorbell system

The first exercise is a doorbell circuit with **three doorbells**. Each doorbell should produce a **different sound** when pressed. Students must:

1. Place the required components (power source, doorbells/buttons, chimes or sound devices, wiring)
2. Wire the circuit so each doorbell triggers only its intended sound
3. Test the circuit (via simulation or graded checks)
4. Submit for grading

This exercise covers switches, parallel/branch wiring, and verifying that each input maps to the correct output — skills that transfer to other residential wiring labs.

## Core features

### Circuit editor (Konva)

The canvas is built with [Konva](https://konvajs.org/). Students drag components onto the stage and connect them with wires.

Planned component types for the doorbell demo and related labs:

| Component | Role |
| --- | --- |
| Power source | Supplies the circuit |
| Wire | Connects terminals between components |
| Switch / doorbell button | Opens or closes a path when pressed |
| Chime / sound device | Output that plays a distinct sound when energized |
| Junction / terminal | Connection points for branching wires |

Students should be able to reposition components, draw wires between terminals, and interact with switches during a test/simulation pass.

### Grading

After a student finishes wiring, the system compares their circuit to an expected solution (or evaluates functional rules), for example:

- Are all required components present?
- Are connections correct for each doorbell → sound path?
- Does pressing doorbell A only energize sound A (and likewise for B and C)?
- Are there short circuits, open circuits, or unused required paths?

Grading can be structural (topology match) and/or behavioral (simulation outcomes).

### Circuit simulation (planned)

Run the student’s diagram as a simple electrical model:

- Trace continuity from power through closed switches to loads
- When a doorbell is “pressed,” close that switch and see which sound device is energized
- Play (or indicate) the correct sound for a passing path; flag incorrect or missing paths

Simulation lets students debug before submitting and gives graders an objective pass/fail signal.

## Tech stack

- **HTML / JavaScript** — app shell and lab logic
- **[Konva](https://konvajs.org/)** — 2D canvas for components, wires, and interaction

The current repo is an early Konva prototype (draggable nodes and connecting arrows) that will evolve into the circuit editor.

## Getting started

Open the app locally (no build step yet):

```bash
# from the project root — any static server works, e.g.:
npx serve .
# or open index.html directly in a browser
```

Then open the served URL (or `index.html`) in a browser. The prototype stage loads with sample connected nodes.

## Project status

**Prototype** — Konva stage with draggable nodes and auto-updating connectors. Next steps toward the doorbell lab:

1. Replace generic flowchart nodes with electrical components (terminals, switches, loads)
2. Model wires as connections between terminals (not just node-to-node arrows)
3. Add switch interaction and a basic continuity / simulation pass
4. Implement the three-doorbell exercise and grading rules
5. Add sound feedback for each doorbell path

## Audience

- **Students** — remote or in-person learners practicing residential wiring for the state exam
- **Instructor** — USU Eastern faculty assigning labs and reviewing graded results
