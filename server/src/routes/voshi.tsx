import { Hono, type Context } from "hono";
import { setCookie } from "hono/cookie";
import type { JWTVerifyGetKey } from "jose";
import { readFormString } from "@/auth/login-url.js";
import type { Env } from "@/config/env.js";
import { parseLocationsClaims, parseProvisionClaims } from "@/voshi/claims.js";
import { isVoshiError, VoshiError } from "@/voshi/errors.js";
import {
  canSubmitGrade,
  requireSyncedGrade,
  submitVoshiGrade,
} from "@/voshi/grades.js";
import { acceptVoshiToken, completeLaunch } from "@/voshi/launch.js";
import { finishProvision } from "@/voshi/provision.js";
import type { ReplayStore } from "@/voshi/replay.js";
import { gradedLabLocations } from "@/voshi/route.js";
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
 * Reads the launch_data form field or throws.
 * @param c - Hono context.
 */
async function readLaunchToken(c: Context<AppEnv>): Promise<string> {
  const body = await c.req.parseBody();
  const token = readFormString(body, "launch_data");
  if (!token) {
    throw new VoshiError("Missing launch_data.", 422, "missing_launch_data");
  }
  return token;
}

/**
 * Renders a Voshi error page.
 * @param c - Hono context.
 * @param err - Thrown value.
 * @param logLabel - Log prefix for this route.
 */
function voshiErrorPage(c: Context<AppEnv>, err: unknown, logLabel: string) {
  const error = isVoshiError(err)
    ? err
    : new VoshiError("Launch failed.", 401, "invalid_launch");
  console.error(`[andy-server] voshi ${logLabel}:`, error.code, error.message);
  return c.html(
    <LaunchErrorPage title="Launch failed" message={error.message} />,
    error.status,
  );
}

/**
 * Replay store for this request (test override or default).
 * @param deps - Route dependencies.
 */
function replayFor(deps: VoshiRouteDeps): ReplayStore {
  return deps.replay ?? defaultReplayStore();
}

/**
 * Voshi LMS launch, provision, locations, and grade routes. Does not implement LTI itself.
 * @param deps - Optional JWKS/replay/fetch overrides for tests.
 */
export function voshiRoutes(deps: VoshiRouteDeps = {}) {
  const routes = new Hono<AppEnv>();

  routes.post("/launch", async (c) => {
    const password = voshiCookiePassword(c.env);

    try {
      assertVoshiCookiePassword(password);
      const token = await readLaunchToken(c);
      const result = await completeLaunch(token, replayFor(deps), deps.getKey);
      const sealed = await sealVoshiSession(result.session, password);
      setCookie(
        c,
        VOSHI_SESSION_COOKIE,
        sealed,
        voshiSessionCookieOptions(new URL(c.req.url)),
      );
      return c.redirect(result.redirectTo, 303);
    } catch (err) {
      return voshiErrorPage(c, err, "launch");
    }
  });

  routes.post("/voshi/provision", async (c) => {
    try {
      const token = await readLaunchToken(c);
      const claims = await acceptVoshiToken(
        token,
        parseProvisionClaims,
        replayFor(deps),
        deps.getKey,
      );
      await finishProvision(claims, deps.fetchImpl ?? fetch);
      return c.body(null, 204);
    } catch (err) {
      return voshiErrorPage(c, err, "provision");
    }
  });

  routes.post("/voshi/locations", async (c) => {
    try {
      const token = await readLaunchToken(c);
      await acceptVoshiToken(
        token,
        parseLocationsClaims,
        replayFor(deps),
        deps.getKey,
      );
      return c.json({ locations: gradedLabLocations });
    } catch (err) {
      return voshiErrorPage(c, err, "locations");
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

      const payload = (await c.req.json().catch(() => ({}))) as {
        score?: unknown;
        comment?: unknown;
      };
      const score = payload.score === undefined ? 0 : payload.score;
      const comment =
        typeof payload.comment === "string" ? payload.comment : undefined;

      const grade = requireSyncedGrade(
        await submitVoshiGrade({
          submitUrl: session.gradeSubmit ?? "",
          apiToken: session.apiToken ?? "",
          score: score as number,
          comment,
          fetchImpl: deps.fetchImpl,
        }),
      );

      return c.json({
        ok: true,
        score: grade.score,
        status: grade.status,
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
