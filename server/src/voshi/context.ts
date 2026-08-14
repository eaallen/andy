import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "@/config/env.js";
import { getAppConfig } from "@/config/env.js";
import { canSubmitGrade } from "@/voshi/grades.js";
import {
  VOSHI_SESSION_COOKIE,
  unsealVoshiSession,
  type VoshiSession,
} from "@/voshi/session.js";
import {
  createCacheReplayStore,
  createMemoryReplayStore,
  type ReplayStore,
} from "@/voshi/replay.js";
import type { VoshiUserRole } from "@/voshi/claims.js";

export type LabClientContext = {
  labId: string | null;
  lockPicker: boolean;
  canGrade: boolean;
  role: VoshiUserRole;
  locationLabel: string;
};

/**
 * JSON the lab page embeds for /lab-client.js (LMS launches only).
 * @param session - Current Voshi session.
 */
export function labClientContext(session: VoshiSession): LabClientContext {
  return {
    labId: session.labId,
    lockPicker: session.role === "student" && Boolean(session.labId),
    canGrade: canSubmitGrade(session),
    role: session.role,
    locationLabel: session.locationLabel,
  };
}

/**
 * Serializes lab client context for a JSON script tag (escapes `<`).
 * @param session - Current Voshi session.
 */
export function serializeLabClientContext(session: VoshiSession): string {
  return JSON.stringify(labClientContext(session)).replace(/</g, "\\u003c");
}

let memoryReplay: ReplayStore | null = null;

/**
 * Cookie password for Voshi sessions. Falls back to the WorkOS cookie secret
 * so local setup can share one value.
 * @param env - Worker bindings.
 */
export function voshiCookiePassword(env: Env): string {
  const config = getAppConfig(env);
  return config.voshiCookiePassword;
}

/**
 * Loads the Voshi LMS session from the request cookie.
 * @param c - Hono context with Worker env bindings.
 */
export async function getVoshiSession(
  // Hono Context `set` is invariant on Variables; accept any Variables shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env; Variables: any }>,
): Promise<VoshiSession | null> {
  if (!c.env) {
    return null;
  }
  const password = voshiCookiePassword(c.env);
  if (!password) {
    return null;
  }
  return unsealVoshiSession(getCookie(c, VOSHI_SESSION_COOKIE), password);
}

/**
 * Replay store for launch tokens. Prefers the Workers Cache API; falls back
 * to process memory when Cache is unavailable (Vitest / some local runs).
 */
export function defaultReplayStore(): ReplayStore {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      return createCacheReplayStore(caches.default);
    }
  } catch {
    // caches.default is a Worker-only binding
  }
  if (!memoryReplay) {
    memoryReplay = createMemoryReplayStore();
  }
  return memoryReplay;
}
