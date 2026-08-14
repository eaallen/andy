import type { JWTVerifyGetKey } from "jose";
import { consumeLaunchToken, type ReplayStore } from "@/voshi/replay.js";
import { labPathFromParams } from "@/voshi/route.js";
import {
  sessionFromClaims,
  type VoshiSession,
} from "@/voshi/session.js";
import { verifyLaunchJwt } from "@/voshi/verify.js";

export type CompleteLaunchResult = {
  session: VoshiSession;
  redirectTo: string;
};

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
  const claims = await verifyLaunchJwt(token, getKey);
  await consumeLaunchToken(token, claims.exp, replay);
  const session = sessionFromClaims(claims);
  return {
    session,
    redirectTo: labPathFromParams(claims.location.params),
  };
}
