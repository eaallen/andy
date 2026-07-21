# AGENTS.md

## Cursor Cloud / agent instructions

This is an **npm workspaces monorepo**:

| Path | Package | Stack |
| --- | --- | --- |
| `frontend/` | `@andy/frontend` | Vite, Vitest, Konva circuit lab |
| `server/` | `@andy/server` | Hono, TypeScript, Gemini / Meta |

### Setup

```bash
npm install
cp server/.env.example server/.env   # set GEMINI_API_KEY or META_API_KEY
```

Requires **Node.js ≥ 20**.

### Dev

```bash
npm run dev:frontend   # http://localhost:5173
npm run dev:server     # http://localhost:3001
```

Vite proxies `/api` → `http://localhost:3001`.

### Tests / typecheck

```bash
npm test
npm run typecheck
```

### AI diagram → YAML

- Route: `POST /api/diagrams/from-image`
- Provider selected by `AI_PROVIDER=gemini|meta|demo` (default `gemini`)
- Lab schema prompt + validation live under `server/src/prompts` and `server/src/lab`
- Author UI: `frontend/author.html`

Do **not** invent new component types in generated YAML without adding a factory in `frontend/js/components.js`. See `frontend/public/labs/README.md`.
