import type { MiddlewareHandler } from "hono";
import type { Env } from "@/config/env.js";
import { getSessionUser, type SessionUser } from "@/auth/session.js";

export type AuthVariables = {
  user: SessionUser;
};

type AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};

/**
 * Requires a valid WorkOS session.
 * HTML navigations redirect to /login; API requests get 401 JSON.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getSessionUser(c);
  if (user) {
    c.set("user", user);
    return next();
  }

  const accept = c.req.header("accept") || "";
  const wantsHtml = accept.includes("text/html");
  const isApi = c.req.path.startsWith("/api/");

  if (isApi || !wantsHtml) {
    return c.json(
      { error: "Authentication required.", code: "unauthorized" },
      401,
    );
  }

  const url = new URL(c.req.url);
  const returnTo = `${url.pathname}${url.search}` || "/author";
  const login = new URL("/login", url.origin);
  login.searchParams.set("returnTo", returnTo);
  return c.redirect(login.toString());
};
