import type { JWTVerifyGetKey } from "jose";
import { consumeLaunchToken, type ReplayStore } from "@/voshi/replay.js";
import { labPathFromExtid } from "@/voshi/route.js";
import {
  sessionFromClaims,
  type VoshiSession,
} from "@/voshi/session.js";
import { parseLaunchClaims } from "@/voshi/claims.js";
import { verifyVoshiJwt } from "@/voshi/verify.js";

export type CompleteLaunchResult = {
  session: VoshiSession;
  redirectTo: string;
};

/**
 * Verifies a Voshi JWT, parses claims, and rejects a replayed token.
 * @param token - Raw launch_data JWT.
 * @param parse - Narrows the verified payload into typed claims (must include exp).
 * @param replay - Store used to reject reused tokens.
 * @param getKey - Optional JWKS resolver (tests inject a local set).
 */
export async function acceptVoshiToken<T extends { exp: number }>(
  token: string,
  parse: (payload: unknown) => T,
  replay: ReplayStore,
  getKey?: JWTVerifyGetKey,
): Promise<T> {
  const payload = await verifyVoshiJwt(token, getKey);
  const claims = parse(payload);
  await consumeLaunchToken(token, claims.exp, replay);
  return claims;
}

/**
 * Verifies launch_data, rejects replay, and returns the Andy session + redirect.
 * @param token - Raw launch_data JWT.
 * @param replay - Store used to reject reused tokens.
 * @param getKey - Optional JWKS resolver (tests inject a local set).
 */
export async function completeLaunch(
  token: string,
  replay: ReplayStore,
  getKey?: JWTVerifyGetKey,
): Promise<CompleteLaunchResult> {
  const claims = await acceptVoshiToken(
    token,
    parseLaunchClaims,
    replay,
    getKey,
  );
  const session = sessionFromClaims(claims);
  return {
    session,
    redirectTo: labPathFromExtid(claims.location.extid),
  };
}
