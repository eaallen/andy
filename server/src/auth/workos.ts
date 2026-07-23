import { WorkOS } from "@workos-inc/node";
import type { AppConfig, Env } from "@/config/env.js";
import { assertWorkosConfigured, getAppConfig } from "@/config/env.js";

export const SESSION_COOKIE = "wos-session";

/**
 * Builds a WorkOS client from Worker env bindings.
 * @param env - Cloudflare Worker bindings.
 */
export function getWorkOS(env: Env): WorkOS {
  const config = getAppConfig(env);
  assertWorkosConfigured(config);
  return new WorkOS(config.workosApiKey, {
    clientId: config.workosClientId,
  });
}

/**
 * Resolves the OAuth redirect URI for WorkOS callbacks.
 * @param config - Normalized app config.
 * @param origin - Request origin (e.g. http://localhost:6767).
 */
export function getRedirectUri(config: AppConfig, origin: string): string {
  if (config.workosRedirectUri) {
    return config.workosRedirectUri;
  }
  return `${origin.replace(/\/$/, "")}/callback`;
}

/**
 * Cookie options for the sealed WorkOS session.
 * @param url - Current request URL (for secure flag on https).
 */
export function sessionCookieOptions(url: URL): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
} {
  return {
    path: "/",
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "Lax",
  };
}
