import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "@/config/env.js";
import { assertWorkosConfigured, getAppConfig } from "@/config/env.js";
import { sanitizeReturnTo } from "@/auth/return-to.js";
import {
  getRedirectUri,
  getWorkOS,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/auth/workos.js";

type AppEnv = { Bindings: Env };

export const authRoutes = new Hono<AppEnv>();

/**
 * GET /login — redirect to hosted AuthKit.
 */
authRoutes.get("/login", (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const returnTo = sanitizeReturnTo(c.req.query("returnTo"));
  const origin = new URL(c.req.url).origin;
  const workos = getWorkOS(c.env);

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: config.workosClientId,
    redirectUri: getRedirectUri(config, origin),
    state: returnTo,
    // Skip the org picker when users arrive from Andy — always use Andy org.
    ...(config.workosOrganizationId
      ? { organizationId: config.workosOrganizationId }
      : {}),
  });

  return c.redirect(authorizationUrl);
});

/**
 * GET /callback — exchange AuthKit code for a sealed session cookie.
 */
authRoutes.get("/callback", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const code = c.req.query("code");
  if (!code) {
    return c.redirect("/login");
  }

  const returnTo = sanitizeReturnTo(c.req.query("state"));
  const url = new URL(c.req.url);

  try {
    const workos = getWorkOS(c.env);
    const { sealedSession } = await workos.userManagement.authenticateWithCode({
      clientId: config.workosClientId,
      code,
      session: {
        sealSession: true,
        cookiePassword: config.workosCookiePassword,
      },
    });

    if (!sealedSession) {
      return c.redirect("/login");
    }

    setCookie(c, SESSION_COOKIE, sealedSession, sessionCookieOptions(url));
    return c.redirect(returnTo);
  } catch (err) {
    console.error("[andy-server] auth callback failed:", err);
    return c.redirect("/login");
  }
});

/**
 * POST /logout — clear session cookie and end WorkOS session.
 */
authRoutes.post("/logout", async (c) => {
  const config = getAppConfig(c.env);
  const url = new URL(c.req.url);
  const sessionData = getCookie(c, SESSION_COOKIE);

  deleteCookie(c, SESSION_COOKIE, { path: "/" });

  if (
    !sessionData ||
    !config.workosApiKey ||
    !config.workosClientId ||
    !config.workosCookiePassword
  ) {
    return c.redirect("/");
  }

  try {
    const workos = getWorkOS(c.env);
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword: config.workosCookiePassword,
    });
    const logoutUrl = await session.getLogoutUrl({
      returnTo: `${url.origin}/`,
    });
    return c.redirect(logoutUrl);
  } catch (err) {
    console.error("[andy-server] logout failed:", err);
    return c.redirect("/");
  }
});
