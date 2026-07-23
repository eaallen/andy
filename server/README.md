# @andy/server

Cloudflare Worker (Hono + Vite) that serves the Andy site and turns a diagram **image** into Andy **lab YAML**.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Marketing site (Hono JSX) |
| `/lab` | Circuit lab shell |
| `/author` | Diagram → YAML UI (**requires WorkOS login**) |
| `/login` | On-site sign-in / sign-up (WorkOS headless APIs) |
| `/callback`, `/logout`, `/auth/initiate` | OAuth callback, logout, dashboard impersonation |
| `/api/diagrams/*` | AI API (**requires WorkOS login**) |
| `/andy.js`, `/labs/*` | Static assets (synced from `@andy/frontend`) |

## Auth (WorkOS User Management)

Sign-in stays on Andy (`/login`): email/password, magic code, and signup. Sessions still use WorkOS sealed cookies. Verified emails appear in the [WorkOS Users](https://dashboard.workos.com) dashboard.

Enable **Email + Password** and **Magic Auth** under Authentication in the WorkOS dashboard.

Local redirects to configure in the WorkOS dashboard:

- Redirect URI: `http://localhost:6767/callback`
- Sign-in endpoint: `http://localhost:6767/auth/initiate` (dashboard impersonation only)
- Sign-out redirect: `http://localhost:6767/`

Set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_COOKIE_PASSWORD` (≥32 chars) in `.dev.vars`.

Set `WORKOS_ORGANIZATION_ID` to the Andy organization (`org_…` from Dashboard → Organizations) so multi-org users are auto-selected and new signups are added to that org.

Export all user emails to CSV:

```bash
npm run export:users -w @andy/server > users.csv
```

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
