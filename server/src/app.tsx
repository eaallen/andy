import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { diagramsRoutes } from "@/routes/diagrams.js";
import { getAppConfig, type Env } from "@/config/env.js";
import { HomePage } from "@/pages/home.js";
import { LabPage } from "@/pages/lab.js";
import { AuthorPage } from "@/pages/author.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("*", async (c, next) => {
  const config = getAppConfig(c.env);
  const origins = config.corsOrigins;
  return cors({
    origin: origins.includes("*")
      ? "*"
      : (origin) => (origins.includes(origin) ? origin : origins[0] || ""),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
  })(c, next);
});

app.get("/health", (c) => {
  const config = getAppConfig(c.env);
  return c.json({
    ok: true,
    service: "andy-server",
    aiProvider: config.aiProvider,
  });
});

app.get("/", (c) => c.html(<HomePage />));
app.get("/lab", (c) => c.html(<LabPage />));
app.get("/author", (c) => c.html(<AuthorPage />));

app.route("/api/diagrams", diagramsRoutes);

/**
 * Fall through to static assets (andy.js, labs YAML, CSS, client scripts).
 */
app.notFound(async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) {
    return asset;
  }
  return c.html(
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Not found — Andy</title>
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>
        <main class="home" style="padding: 3rem 1.5rem">
          <h1>Page not found</h1>
          <p>
            <a href="/">Back to Andy</a>
          </p>
        </main>
      </body>
    </html>,
    404,
  );
});

app.onError((err, c) => {
  console.error("[andy-server] error:", err);
  const maybeStatus = (err as unknown as { status?: unknown }).status;
  const status =
    typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 600
      ? (maybeStatus as 400 | 401 | 403 | 404 | 413 | 500 | 502 | 503)
      : 500;
  return c.json(
    {
      error: err.message || "Internal server error",
      code: (err as unknown as { code?: string }).code,
    },
    status,
  );
});

export { app };
