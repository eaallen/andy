# @andy/server

Cloudflare Worker (Hono + Vite) that serves the Andy site and turns a diagram **image** into Andy **lab YAML**.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Marketing site (Hono JSX) |
| `/lab` | Circuit lab shell |
| `/author` | Diagram → YAML UI |
| `/api/diagrams/*` | AI API |
| `/andy.js`, `/labs/*` | Static assets (synced from `@andy/frontend`) |

## Providers

| `AI_PROVIDER` | Package | Typical model env |
| --- | --- | --- |
| `gemini` | `@google/genai` | `GEMINI_MODEL=gemini-2.5-flash` |
| `meta` | `openai` → `api.meta.ai` | `META_MODEL=muse-spark-1.1`, `META_API_KEY` |
| `demo` (wrangler default) | (fixture) | offline YAML for UI walkthroughs |

## Local config

Copy `.env.example` → `.dev.vars` (Wrangler / Cloudflare Vite plugin bindings).

## Scripts

```bash
npm run dev -w @andy/server       # Vite + workerd
npm run deploy -w @andy/server    # build + wrangler deploy
npm run test -w @andy/server
npm run typecheck -w @andy/server
```
