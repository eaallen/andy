import { EncryptJWT, jwtDecrypt } from "jose";
import type { LaunchClaims } from "@/voshi/claims.js";
import {
  VOSHI_SESSION_COOKIE,
  VOSHI_SESSION_MAX_AGE_SECONDS,
} from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";
import { sanitizeLabId } from "@/voshi/route.js";
import type { VoshiLocationType, VoshiUserRole } from "@/voshi/claims.js";

export type VoshiSession = {
  launchId: string;
  userId: string;
  role: VoshiUserRole;
  courseId: string;
  locationId: string;
  locationType: VoshiLocationType;
  locationLabel: string;
  labId: string | null;
  gradePassback: boolean;
};

export { VOSHI_SESSION_COOKIE };

/**
 * Derives a 256-bit AES key from the cookie password.
 * @param password - VOSHI_COOKIE_PASSWORD (or WorkOS fallback).
 */
async function cookieKey(password: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  return new Uint8Array(digest);
}

/**
 * Builds the session Andy stores after a verified launch.
 * @param claims - Parsed launch claims.
 */
export function sessionFromClaims(claims: LaunchClaims): VoshiSession {
  return {
    launchId: claims.launchId,
    userId: claims.userId,
    role: claims.role,
    courseId: claims.courseId,
    locationId: claims.location.id,
    locationType: claims.location.type,
    locationLabel: claims.location.label,
    labId: sanitizeLabId(claims.location.params.lab),
    gradePassback: claims.gradePassback,
  };
}

/**
 * Encrypts a Voshi session as a JWE cookie value.
 * @param session - Session to seal.
 * @param password - Symmetric cookie password.
 */
export async function sealVoshiSession(
  session: VoshiSession,
  password: string,
): Promise<string> {
  const key = await cookieKey(password);
  return new EncryptJWT({ voshi: session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${VOSHI_SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(key);
}

/**
 * Decrypts a Voshi session cookie. Returns null if missing or invalid.
 * @param cookie - Raw cookie value.
 * @param password - Symmetric cookie password.
 */
export async function unsealVoshiSession(
  cookie: string | undefined,
  password: string,
): Promise<VoshiSession | null> {
  if (!cookie || !password) {
    return null;
  }
  try {
    const key = await cookieKey(password);
    const { payload } = await jwtDecrypt(cookie, key, {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    const voshi = payload.voshi;
    if (!voshi || typeof voshi !== "object") {
      return null;
    }
    return voshi as VoshiSession;
  } catch (error) {
    console.error("Error decrypting Voshi session cookie:", error);
    return null;
  }
}

/**
 * Cookie options for the Voshi session. SameSite=None on HTTPS so LMS iframes work.
 * @param url - Current request URL.
 */
export function voshiSessionCookieOptions(url: URL): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "None" | "Lax";
  maxAge: number;
} {
  const secure = url.protocol === "https:";
  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    maxAge: VOSHI_SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Throws when the Voshi session cookie password is missing or too short.
 * @param password - Candidate password.
 */
export function assertVoshiCookiePassword(password: string): void {
  if (!password || password.length < 32) {
    throw new VoshiError(
      "VOSHI_COOKIE_PASSWORD (or WORKOS_COOKIE_PASSWORD) must be at least 32 characters to receive launches.",
      503,
      "missing_voshi_config",
    );
  }
}
