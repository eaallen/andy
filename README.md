# Remote Electrician Lab (Andy)

A web-based circuit lab for USU Eastern students preparing for the Utah state electrician certification exam. Students who cannot attend in-person lab sessions can still build, test, and submit circuit work remotely.

## Monorepo layout

```
andy/
├── frontend/          # Vite + Konva circuit lab (existing Andy UI / CDN library)
├── server/            # Hono + TypeScript API (diagram image → lab YAML)
├── package.json       # npm workspaces root
└── README.md
```

| Package | Role |
| --- | --- |
| `@andy/frontend` | Interactive circuit editor, Demo/Lab/Check, YAML lab loader |
| `@andy/server` | AI authoring API — upload a diagram image, get Andy lab YAML |

## The problem

Hands-on labs are a core part of the electrician prep course. Many students work full-time or are out of state when lab sessions run, so they miss the practice that matters most for the exam. This project brings that lab experience online: diagram circuits, wire them correctly, and get feedback on whether the build works.

## Goals

- Let remote students participate in the same lab exercises as students on campus
- Provide a visual circuit editor for placing and connecting electrical components
- Grade student work against a correct reference circuit
- Optionally simulate the circuit so students can verify behavior before submitting
- Support multiple Utah exam–style exercises from lab files (YAML/JSON)
- **Author labs from a photo/screenshot of a hand-drawn or printed diagram** (AI → YAML)

## How labs work

Exercises live under [`frontend/public/labs/`](frontend/public/labs/). JavaScript owns component visuals and factories; each lab file owns layout, demo wires, continuity simulation, and Check grading. See the [lab authoring guide](frontend/public/labs/README.md).

The app shell includes a lab picker (`?lab=doorbell`, `?lab=three-way-lamp`, …) and a **Create from image** page at `/author.html`.

### Modes

| Mode | What it does |
| --- | --- |
| **Demo** | Pre-wired reference circuit from the lab file. Press buttons / toggle switches to exercise simulation feedback. |
| **Lab** | Same components start unwired. Draw terminal-to-terminal wires, test continuity, then **Check** for pass/fail grading. |

## AI diagram → YAML (server)

The Hono API accepts an image of a wiring diagram and returns Andy lab YAML.

| Provider | Env | Notes |
| --- | --- | --- |
| **Gemini** (default) | `GEMINI_API_KEY`, `GEMINI_MODEL` | Multimodal diagram → YAML |
| **Meta** | `META_API_KEY`, `META_MODEL` | OpenAI SDK → `https://api.meta.ai/v1` |
| **Demo** | `AI_PROVIDER=demo` | Offline fixture YAML (no API key) |

```bash
# from repo root
cp server/.env.example server/.env   # add GEMINI_API_KEY or META_API_KEY
npm install
npm run dev:server                   # http://localhost:3001
npm run dev:frontend                 # http://localhost:5173 (proxies /api → :3001)
```

Open [http://localhost:5173/author.html](http://localhost:5173/author.html), upload a diagram, then **Open in lab**.

### API

`POST /api/diagrams/from-image`

- `multipart/form-data`: fields `image` (file), optional `title`, `notes`
- or JSON: `{ imageBase64, mimeType, title?, notes? }`

Response:

```json
{
  "yaml": "title: ...",
  "lab": { "title": "...", "components": [] },
  "warnings": [],
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

`GET /health` — liveness + configured provider.

## Included labs

| Lab | Id | Focus |
| --- | --- | --- |
| Doorbell | `doorbell` | Front own chime; Rear + Side share Rear |
| Single-pole lamp | `single-pole-lamp` | SPST switch controls a lamp |
| Three-way lamp | `three-way-lamp` | Two 3-way switches, travelers |
| Four-way lamp | `four-way-lamp` | Two 3-ways + middle 4-way |
| GFCI downstream | `gfci-downstream` | LINE feed; LOAD protects a receptacle |
| Multi-wire branch | `multi-wire-branch` | L1 + L2 loads on a shared neutral |

## Tech stack

- **Frontend** — HTML / CSS / JS, Vite, Vitest, Konva, js-yaml
- **Server** — Node 20+, Hono, TypeScript, `@/` path aliases, Gemini
- **Web Audio API** — sound profiles from lab config (no sound files)

## Getting started

```bash
npm install
npm run dev:frontend    # circuit lab UI
npm run dev:server      # AI YAML API (needs API key in server/.env)
```

### Scripts (root)

| Command | What it does |
| --- | --- |
| `npm run dev:frontend` | Vite app at `:5173` |
| `npm run dev:server` | Hono API at `:3001` |
| `npm run build` | Build frontend + server |
| `npm run build:lib` | Build CDN IIFE `andy.js` |
| `npm test` | Frontend + server tests |
| `npm run typecheck` | TypeScript check for the server |

## Project status

**Utah exam starter catalog** — Demo/Lab/Check/Test driven by YAML under `frontend/public/labs/`.

**AI authoring MVP** — image → YAML via Gemini, with schema validation and a simple author UI.

Next steps toward a fuller remote lab:

1. Richer grading feedback and instructor review
2. Optional short-circuit / open-circuit diagnostics
3. Student submit / persistence
4. Persist AI-generated labs to disk / catalog (instructor approve flow)

## Audience

- **Students** — remote or in-person learners practicing residential wiring for the state exam
- **Instructor** — USU Eastern faculty assigning labs and reviewing graded results
- **Authors / AI** — draft new labs from a diagram image or the [authoring guide](frontend/public/labs/README.md)
