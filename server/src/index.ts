import { serve } from "@hono/node-server";
import { app } from "@/app.js";
import { env } from "@/config/env.js";

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`[andy-server] listening on http://localhost:${info.port}`);
    console.log(`[andy-server] AI provider: ${env.aiProvider}`);
  },
);
