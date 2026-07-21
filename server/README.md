# @andy/server

Hono + TypeScript API that turns a diagram **image** into Andy **lab YAML**.

## Providers

| `AI_PROVIDER` | Package | Typical model env |
| --- | --- | --- |
| `cursor` (default) | `@cursor/sdk` | `CURSOR_MODEL=grok-4.5` |
| `gemini` | `@google/genai` | `GEMINI_MODEL=gemini-2.5-flash` |

Cursor SDK is the short-term path (same agent/models as Cursor IDE, including Grok when enabled on the account). Gemini is a lighter multimodal call and a strong long-term default.

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
