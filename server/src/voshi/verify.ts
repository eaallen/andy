import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { parseLaunchClaims, type LaunchClaims } from "@/voshi/claims.js";
import { VOSHI_JWKS_URL } from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";

const remoteJwks = createRemoteJWKSet(new URL(VOSHI_JWKS_URL));

/**
 * Verifies a Voshi launch JWT (RS256 + expiry) and returns parsed claims.
 * @param token - Compact JWS from the launch_data form field.
 * @param getKey - JWKS key resolver; defaults to Voshi's public JWKS.
 */
export async function verifyLaunchJwt(
  token: string,
  getKey?: JWTVerifyGetKey,
): Promise<LaunchClaims> {
  if (!token) {
    throw new VoshiError(
      "Missing launch_data.",
      422,
      "missing_launch_data",
    );
  }

  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteJwks, {
      algorithms: ["RS256"],
    });
    return parseLaunchClaims(payload);
  } catch (err) {
    if (err instanceof VoshiError) {
      throw err;
    }
    throw new VoshiError(
      "Launch token could not be verified.",
      401,
      "invalid_launch",
    );
  }
}
