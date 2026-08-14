import { LOCATION_TYPES, USER_ROLES } from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";

export type VoshiUserRole = (typeof USER_ROLES)[number];
export type VoshiLocationType = (typeof LOCATION_TYPES)[number];

export type LaunchLocation = {
  id: string;
  type: VoshiLocationType;
  label: string;
  params: Record<string, string>;
};

export type LaunchClaims = {
  launchId: string;
  userId: string;
  role: VoshiUserRole;
  courseId: string;
  location: LaunchLocation;
  gradePassback: boolean;
  exp: number;
};

const ROLE_SET = new Set<string>(USER_ROLES);
const LOCATION_TYPE_SET = new Set<string>(LOCATION_TYPES);

/**
 * Trims a string value, or returns "" when the value is not a non-blank string.
 * @param value - Candidate string.
 */
function trimmedStringOrEmpty(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Reads a required string claim, recording its name when blank.
 * @param value - Candidate string.
 * @param claim - Dotted claim path (e.g. "user.id").
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readRequiredString(
  value: unknown,
  claim: string,
  problems: string[],
): string {
  const text = trimmedStringOrEmpty(value);
  if (!text) {
    problems.push(claim);
  }
  return text;
}

/**
 * Reads a required string that must be one of `allowed`.
 * @param value - Candidate string.
 * @param claim - Dotted claim path.
 * @param allowed - Accepted values.
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readAllowedString(
  value: unknown,
  claim: string,
  allowed: Set<string>,
  problems: string[],
): string {
  const text = readRequiredString(value, claim, problems);
  if (text && !allowed.has(text)) {
    problems.push(`${claim} (got ${JSON.stringify(text)})`);
  }
  return text;
}

/**
 * Reads location.params, keeping only string values (Voshi always sends strings).
 * @param raw - Unknown params object.
 */
function parseParams(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Throws when any required claims failed to parse.
 * @param problems - Missing or invalid claim names.
 */
function throwIfInvalidClaims(problems: string[]): void {
  if (problems.length === 0) {
    return;
  }
  throw new VoshiError(
    `Launch token was missing or invalid claims: ${problems.join(", ")}.`,
    422,
    "invalid_launch_claims",
  );
}

/**
 * Narrows a verified JWT payload into the launch claims Andy stores.
 * @param payload - Verified JWT payload (do not pass unverified tokens).
 */
export function parseLaunchClaims(payload: unknown): LaunchClaims {
  if (!payload || typeof payload !== "object") {
    throw new VoshiError(
      "Launch token was missing or invalid claims: payload.",
      422,
      "invalid_launch_claims",
    );
  }

  const raw = payload as Record<string, unknown>;
  const user =
    raw.user && typeof raw.user === "object"
      ? (raw.user as Record<string, unknown>)
      : {};
  const course =
    raw.course && typeof raw.course === "object"
      ? (raw.course as Record<string, unknown>)
      : {};
  const locationRaw =
    raw.location && typeof raw.location === "object"
      ? (raw.location as Record<string, unknown>)
      : {};

  const problems: string[] = [];
  const launchId = trimmedStringOrEmpty(raw.launch_id); // we may want to make this required. 
  const userId = readRequiredString(user.id, "user.id", problems);
  const role = readAllowedString(user.role, "user.role", ROLE_SET, problems);
  const courseId = readRequiredString(course.id, "course.id", problems);
  const locationId = readRequiredString(locationRaw.id, "location.id", problems);
  const locationType = readAllowedString(
    locationRaw.type,
    "location.type",
    LOCATION_TYPE_SET,
    problems,
  );
  const locationLabel = trimmedStringOrEmpty(locationRaw.label);
  const exp = raw.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    problems.push("exp");
  }

  throwIfInvalidClaims(problems);

  return {
    launchId,
    userId,
    role: role as VoshiUserRole,
    courseId,
    location: {
      id: locationId,
      type: locationType as VoshiLocationType,
      label: locationLabel || locationType,
      params: parseParams(locationRaw.params),
    },
    gradePassback: raw.grade_passback === true,
    exp: exp as number,
  };
}
