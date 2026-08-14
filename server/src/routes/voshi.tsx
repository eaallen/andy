import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { JWTVerifyGetKey } from "jose";
import { readFormString } from "@/auth/login-url.js";
import type { Env } from "@/config/env.js";
import { getAppConfig } from "@/config/env.js";
import { isVoshiError, VoshiError } from "@/voshi/errors.js";
import {
  canSubmitGrade,
  requireSyncedGrade,
  submitVoshiGrade,
} from "@/voshi/grades.js";
import { completeLaunch } from "@/voshi/launch.js";
import type { ReplayStore } from "@/voshi/replay.js";
import {
  defaultReplayStore,
  getVoshiSession,
  voshiCookiePassword,
} from "@/voshi/context.js";
import {
  assertVoshiCookiePassword,
  sealVoshiSession,
  VOSHI_SESSION_COOKIE,
  voshiSessionCookieOptions,
} from "@/voshi/session.js";

type AppEnv = {
  Bindings: Env;
  // Hono Context is invariant on Variables; match getVoshiSession.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Variables: any;
};

export type VoshiRouteDeps = {
  getKey?: JWTVerifyGetKey;
  replay?: ReplayStore;
  fetchImpl?: typeof fetch;
};

function LaunchErrorPage(props: { title: string; message: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.title} — Andy</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>
        <main class="home" style="padding: 3rem 1.5rem">
          <h1>{props.title}</h1>
          <p>{props.message}</p>
        </main>
      </body>
    </html>
  );
}

/**
 * Voshi LMS launch + grade passback routes. Does not implement LTI itself.
 * @param deps - Optional JWKS/replay/fetch overrides for tests.
 */
export function voshiRoutes(deps: VoshiRouteDeps = {}) {
  const routes = new Hono<AppEnv>();

  routes.post("/launch", async (c) => {
    const password = voshiCookiePassword(c.env);

    try {
      assertVoshiCookiePassword(password);
      const body = await c.req.parseBody();
      const token = readFormString(body, "launch_data");
      if (!token) {
        throw new VoshiError(
          "Missing launch_data.",
          422,
          "missing_launch_data",
        );
      }

      const result = await completeLaunch(
        token,
        deps.replay ?? defaultReplayStore(),
        deps.getKey,
      );
      const sealed = await sealVoshiSession(result.session, password);
      setCookie(
        c,
        VOSHI_SESSION_COOKIE,
        sealed,
        voshiSessionCookieOptions(new URL(c.req.url)),
      );
      return c.redirect(result.redirectTo, 303);
    } catch (err) {
      const error = isVoshiError(err)
        ? err
        : new VoshiError("Launch failed.", 401, "invalid_launch");
      console.error("[andy-server] voshi launch:", error.code, error.message);
      return c.html(
        <LaunchErrorPage title="Launch failed" message={error.message} />,
        error.status,
      );
    }
  });

  routes.post("/api/voshi/grade", async (c) => {
    try {
      const session = await getVoshiSession(c);
      if (!session) {
        return c.json(
          { error: "No LMS session.", code: "unauthorized" },
          401,
        );
      }
      if (!canSubmitGrade(session)) {
        throw new VoshiError(
          "This launch cannot send a grade.",
          422,
          "grade_unavailable",
        );
      }

      const config = getAppConfig(c.env);
      const payload = (await c.req.json().catch(() => ({}))) as {
        score?: unknown;
        comment?: unknown;
      };
      const score =
        payload.score === undefined ? 0 : payload.score;
      const comment =
        typeof payload.comment === "string" ? payload.comment : undefined;

      const grade = requireSyncedGrade(
        await submitVoshiGrade({
          apiKey: config.voshiApiKey,
          launchId: session.launchId,
          score: score as number,
          comment,
          fetchImpl: deps.fetchImpl,
        }),
      );

      return c.json({
        ok: true,
        score: grade.score,
        syncStatus: grade.sync_status,
        syncError: grade.sync_error,
      });
    } catch (err) {
      console.error("[andy-server] voshi grade:", err);
      if (isVoshiError(err)) {
        return c.json(
          { error: err.message, code: err.code },
          err.status,
        );
      }
      return c.json(
        { error: "Grade failed.", code: "grade_failed" },
        500,
      );
    }
  });

  return routes;
}
