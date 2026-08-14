import { VoshiError } from "@/voshi/errors.js";

export type ReplayStore = {
  /**
   * Records `key` until `ttlSeconds` elapses. Returns true if this is the first
   * time the key was seen.
   */
  consume: (key: string, ttlSeconds: number) => Promise<boolean>;
};

/**
 * SHA-256 hex digest of a launch token, used as the replay key.
 * @param token - Raw launch_data JWT.
 */
export async function hashLaunchToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * In-memory replay store for tests (and local fallback when Cache is missing).
 */
export function createMemoryReplayStore(): ReplayStore {
  const seen = new Map<string, number>();

  return {
    async consume(key, ttlSeconds) {
      const now = Date.now();
      const expiresAt = seen.get(key);
      if (expiresAt !== undefined && expiresAt > now) {
        return false;
      }
      seen.set(key, now + Math.max(1, ttlSeconds) * 1000);
      return true;
    },
  };
}

/**
 * Replay store backed by the Workers Cache API. Keys expire with the JWT.
 * @param cache - Cache instance (typically `caches.default`).
 */
export function createCacheReplayStore(cache: Cache): ReplayStore {
  return {
    async consume(key, ttlSeconds) {
      const request = new Request(`https://voshi-replay.andy/${key}`);
      const existing = await cache.match(request);
      if (existing) {
        return false;
      }
      const ttl = Math.max(1, ttlSeconds);
      await cache.put(
        request,
        new Response("1", {
          headers: { "Cache-Control": `max-age=${ttl}` },
        }),
      );
      return true;
    },
  };
}

/**
 * Rejects a launch token that has already been exchanged for a session.
 * @param token - Raw launch_data JWT.
 * @param exp - JWT expiry as Unix seconds.
 * @param store - Replay store.
 * @param nowSeconds - Current Unix seconds (injectable for tests).
 */
export async function consumeLaunchToken(
  token: string,
  exp: number,
  store: ReplayStore,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<void> {
  const ttlSeconds = Math.max(1, exp - nowSeconds);
  const key = await hashLaunchToken(token);
  const firstUse = await store.consume(key, ttlSeconds);
  if (!firstUse) {
    throw new VoshiError(
      "This launch has already been used.",
      401,
      "launch_replay",
    );
  }
}
