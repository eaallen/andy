# @andy/server

Hono + TypeScript API that turns a diagram **image** into Andy **lab YAML**.

## Providers

| `AI_PROVIDER` | Package | Typical model env |
| --- | --- | --- |
| `gemini` (default) | `@google/genai` | `GEMINI_MODEL=gemini-2.5-flash` |
| `meta` | `openai` → `api.meta.ai` | `META_MODEL=muse-spark-1.1`, `META_API_KEY` |
| `demo` | (fixture) | offline YAML for UI walkthroughs |

## Path aliases

TypeScript `paths` map `@/*` → `src/*` (e.g. `import { env } from "@/config/env.js"`).

- Dev: `tsx` resolves aliases
- Build: `tsc` + `tsc-alias`

## Scripts

```bash
npm run dev -w @andy/server
npm run test -w @andy/server
npm run typecheck -w @andy/server
```
