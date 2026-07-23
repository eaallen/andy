import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "@/config/env.js";
import { getAppConfig } from "@/config/env.js";
import {
  getWorkOS,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/auth/workos.js";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Maps a WorkOS user object into the shape used by pages and middleware.
 * @param user - WorkOS user from authenticate / refresh.
 */
function toSessionUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

/**
 * Loads the sealed session from the request cookie, refreshing when needed.
 * Returns null when unauthenticated or WorkOS is not configured.
 * @param c - Hono context with Worker env bindings.
 */
export async function getSessionUser(
  // Hono Context `set` is invariant on Variables; accept any Variables shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env; Variables: any }>,
): Promise<SessionUser | null> {
  if (!c.env) {
    return null;
  }

  const config = getAppConfig(c.env);
  if (
    !config.workosApiKey ||
    !config.workosClientId ||
    !config.workosCookiePassword
  ) {
    return null;
  }

  const sessionData = getCookie(c, SESSION_COOKIE);
  if (!sessionData) {
    return null;
  }

  try {
    const workos = getWorkOS(c.env);
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword: config.workosCookiePassword,
    });

    const auth = await session.authenticate();
    if (auth.authenticated) {
      return toSessionUser(auth.user);
    }

    try {
      const refreshed = await session.refresh();
      if (!refreshed.authenticated || !refreshed.sealedSession) {
        deleteCookie(c, SESSION_COOKIE, { path: "/" });
        return null;
      }
      const url = new URL(c.req.url);
      setCookie(
        c,
        SESSION_COOKIE,
        refreshed.sealedSession,
        sessionCookieOptions(url),
      );
      return toSessionUser(refreshed.user);
    } catch {
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return null;
    }
  } catch {
    return null;
  }
}
