import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { diagramsRoutes } from "@/routes/diagrams.js";
import { env } from "@/config/env.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.corsOrigins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "andy-server",
    aiProvider: env.aiProvider,
  }),
);

app.route("/api/diagrams", diagramsRoutes);

app.onError((err, c) => {
  console.error("[andy-server] error:", err);
  const maybeStatus = (err as unknown as { status?: unknown }).status;
  const status =
    typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 600
      ? (maybeStatus as 400 | 401 | 403 | 404 | 413 | 422 | 500 | 502 | 503)
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
