# AGENTS.md

## Cursor Cloud / agent instructions

This is an **npm workspaces monorepo**:

| Path | Package | Stack |
| --- | --- | --- |
| `frontend/` | `@andy/frontend` | Vite, Vitest, Konva circuit lab **client library** (`andy.js`) |
| `server/` | `@andy/server` | Hono + JSX on Cloudflare Workers (Vite plugin), marketing site, lab/author UI, AI API |

### Setup

```bash
npm install
cp server/.env.example server/.dev.vars   # set GEMINI_API_KEY or META_API_KEY (or AI_PROVIDER=demo)
# Also set WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD (AuthKit)
```

Requires **Node.js ≥ 20**.

### Auth (WorkOS)

- Hosted AuthKit; open signup. Users (emails) live in the WorkOS dashboard.
- Protects `/author` and `POST /api/diagrams/*`. `/` and `/lab` stay public.
- Local redirect URIs: `http://localhost:6767/callback`, sign-in `/login`, sign-out `/`.
- Export emails: `npm run export:users -w @andy/server > users.csv`

### Dev

```bash
npm run dev              # Worker + site via Vite (Cloudflare plugin) — http://localhost:6767
npm run dev:frontend     # frontend-only Vite (library / local experiments)
```

Routes served by the Worker:

| Path | Purpose |
| --- | --- |
| `/` | Project marketing site |
| `/lab` | Circuit lab shell (loads `/andy.js` + `/labs/*.yaml`) |
| `/author` | Diagram → YAML author UI (auth required) |
| `/login`, `/callback`, `/logout` | WorkOS AuthKit |
| `/api/diagrams/*` | AI diagram API (auth required) |
| `/andy.js`, `/labs/*` | Static client lib + lab YAML |

### Tests / typecheck / deploy

```bash
npm test
npm run typecheck
npm run deploy           # vite build + wrangler deploy
```

### AI diagram → YAML

- Route: `POST /api/diagrams/from-image`
- Provider selected by `AI_PROVIDER=gemini|meta|demo` (vars / secrets; wrangler default `demo`)
- Lab schema prompt + validation live under `server/src/prompts` and `server/src/lab`
- Author UI: `/author` (Hono JSX)

Do **not** invent new component types in generated YAML without adding a factory under `frontend/js/components/` (and registering it in `registry.js`). See `frontend/public/labs/README.md`.
