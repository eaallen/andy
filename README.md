# Remote Electrician Lab (Andy)

A web-based circuit lab for USU Eastern students preparing for the Utah state electrician certification exam. Students who cannot attend in-person lab sessions can still build, test, and submit circuit work remotely.

## Monorepo layout

```
andy/
├── frontend/          # Circuit lab client library (Konva) → andy.js
├── server/            # Cloudflare Worker: site + lab/author UI + AI API
├── package.json       # npm workspaces root
└── README.md
```

| Package | Role |
| --- | --- |
| `@andy/frontend` | Interactive circuit editor library (Demo/Lab/Check), YAML loader, CDN IIFE |
| `@andy/server` | Hono Worker — marketing site, `/lab`, `/author`, diagram → YAML API |

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

Exercises live under [`frontend/public/labs/`](frontend/public/labs/) (synced into the Worker as `/labs/*`). JavaScript owns component visuals and factories; each lab file owns layout, demo wires, continuity simulation, and Check grading. See the [lab authoring guide](frontend/public/labs/README.md).

The site serves:

| Path | Purpose |
| --- | --- |
| `/` | Project overview |
| `/lab` | Lab picker (`?lab=doorbell`, `?lab=draft`, …) |
| `/author` | Create a lab from a diagram image |

Pages load the IIFE client library at `/andy.js` (`AndyCircuitLab.mountCircuitLab` / `scanAndMountLabs`).

### Modes

| Mode | What it does |
| --- | --- |
| **Demo** | Pre-wired reference circuit from the lab file. Press buttons / toggle switches to exercise simulation feedback. |
| **Lab** | Same components start unwired. Draw terminal-to-terminal wires, test continuity, then **Check** for pass/fail grading. |

## AI diagram → YAML

The Worker API accepts an image of a wiring diagram and returns Andy lab YAML.

| Provider | Env | Notes |
| --- | --- | --- |
| **Gemini** | `GEMINI_API_KEY`, `GEMINI_MODEL` | Multimodal diagram → YAML |
| **Meta** | `META_API_KEY`, `META_MODEL` | OpenAI SDK → `https://api.meta.ai/v1` |
| **Demo** | `AI_PROVIDER=demo` | Offline fixture YAML (no API key) |

```bash
# from repo root
cp server/.env.example server/.dev.vars   # local Worker bindings
npm install
npm run dev                               # http://localhost:6767
```

Open [/author](http://localhost:6767/author), upload a diagram, then **Open in lab**.

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

- **Frontend library** — HTML / CSS / JS, Vite, Vitest, Konva, js-yaml
- **Server** — Cloudflare Workers, Hono JSX, Vite (`@cloudflare/vite-plugin`), Wrangler
- **Web Audio API** — sound profiles from lab config (no sound files)

## Getting started

```bash
npm install
cp server/.env.example server/.dev.vars
npm run dev                 # full site + API on :6767
```

### Deploy (Cloudflare)

```bash
npx wrangler login          # once
# optional: npx wrangler secret put GEMINI_API_KEY
npm run deploy              # builds andy.js + Worker, deploys to *.workers.dev
```

Default production `AI_PROVIDER` is `demo` (see `server/wrangler.jsonc`). Set `AI_PROVIDER` / API key secrets for live Gemini or Meta.

### Scripts (root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Worker + site (Vite Cloudflare) at `:6767` |
| `npm run dev:frontend` | Frontend Vite only (library experiments) |
| `npm run build` | Sync assets + build Worker |
| `npm run build:lib` | Build CDN IIFE `andy.js` |
| `npm run deploy` | Build and `wrangler deploy` |
| `npm test` | Frontend + server tests |
| `npm run typecheck` | TypeScript check for the server |

## Project status

**Utah exam starter catalog** — Demo/Lab/Check/Test driven by YAML under `frontend/public/labs/`.

**AI authoring MVP** — image → YAML via Gemini (or demo fixture), with schema validation and author UI on the Worker.

Next steps toward a fuller remote lab:

1. Richer grading feedback and instructor review
2. Optional short-circuit / open-circuit diagnostics
3. Student submit / persistence
4. Persist AI-generated labs to disk / catalog (instructor approve flow)

## Audience

- **Students** — remote or in-person learners practicing residential wiring for the state exam
- **Instructor** — USU Eastern faculty assigning labs and reviewing graded results
- **Authors / AI** — draft new labs from a diagram image or the [authoring guide](frontend/public/labs/README.md)
