# AGENTS.md

## Cursor Cloud specific instructions

This is a **buildless, static frontend** project (Remote Electrician Lab). There is no
package manager, no `package.json`/lockfile, no build step, and no automated
lint/test/build tooling. See `README.md` for the product overview.

### Running the app (dev)

Serve the repo root over HTTP and open `index.html`. Any static server works, e.g.:

```bash
python3 -m http.server 8000   # then open http://localhost:8000/index.html
# or: npx serve .
```

- Do **not** open `index.html` via `file://` — the app uses ES module imports and
  `fetch()` (e.g. `js/lab-config.js` fetches `labs/doorbell.yaml`), which browsers block
  over `file://`. It must be served over HTTP.
- Runtime dependencies (Konva 9, js-yaml 4) are imported directly from the `esm.sh` CDN
  and are **not vendored**, so the app requires outbound network access to
  `https://esm.sh` to render. If offline, dependencies would need to be vendored first.
- A `favicon.ico` 404 in the console is expected and harmless.

### Lint / test / build

None exist. Verification is manual/in-browser: load the served page, use **Demo** and
**Lab** modes, wire terminals, press the Front/Rear/Side doorbell buttons, run **Test**
(Front → Rear → Side) and **Check** (grading).
