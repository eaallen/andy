import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { diagramsRoutes } from "@/routes/diagrams.js";
import { authRoutes } from "@/routes/auth.js";
import { voshiRoutes } from "@/routes/voshi.js";
import { getAppConfig, type Env } from "@/config/env.js";
import { getSessionUser, type SessionUser } from "@/auth/session.js";
import { requireAuth } from "@/auth/middleware.js";
import { getVoshiSession } from "@/voshi/context.js";
import { HomePage } from "@/pages/home.js";
import { LabPage } from "@/pages/lab.js";
import { AuthorPage } from "@/pages/author.js";

type AppEnv = {
  Bindings: Env;
  Variables: {
    user: SessionUser;
  };
};

const app = new Hono<AppEnv>();

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

app.route("/", authRoutes);
app.route("/", voshiRoutes());

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  return c.html(<HomePage user={user} />);
});

app.get("/lab", async (c) => {
  const user = await getSessionUser(c);
  const voshi = await getVoshiSession(c);
  return c.html(<LabPage user={user} voshi={voshi} />);
});

app.get("/author", requireAuth, async (c) => {
  const user = c.get("user");
  return c.html(<AuthorPage user={user} />);
});

app.use("/api/diagrams/*", requireAuth);
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
