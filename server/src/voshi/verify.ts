import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { parseLaunchClaims, type LaunchClaims } from "@/voshi/claims.js";
import { VOSHI_ISS, VOSHI_JWKS_URL } from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";

const remoteJwks = createRemoteJWKSet(new URL(VOSHI_JWKS_URL));

/**
 * Verifies a Voshi JWT (RS256, expiry, Voshi issuer) and returns the payload.
 * @param token - Compact JWS from the launch_data form field.
 * @param getKey - JWKS key resolver; defaults to Voshi's public JWKS.
 */
export async function verifyVoshiJwt(
  token: string,
  getKey?: JWTVerifyGetKey,
): Promise<unknown> {
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
      issuer: VOSHI_ISS,
    });
    return payload;
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

/**
 * Verifies a Voshi launch JWT and returns parsed launch claims.
 * @param token - Compact JWS from the launch_data form field.
 * @param getKey - JWKS key resolver; defaults to Voshi's public JWKS.
 */
export async function verifyLaunchJwt(
  token: string,
  getKey?: JWTVerifyGetKey,
): Promise<LaunchClaims> {
  const payload = await verifyVoshiJwt(token, getKey);
  return parseLaunchClaims(payload);
}
