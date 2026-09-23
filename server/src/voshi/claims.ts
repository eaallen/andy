import {
  LOCATION_TYPES,
  STAFF_GROUPS,
  USER_GROUPS,
  VOSHI_ISS,
} from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";

export type VoshiUserGroup = (typeof USER_GROUPS)[number];
export type VoshiLocationType = (typeof LOCATION_TYPES)[number];

export type LaunchLocation = {
  id: string;
  extid: string;
  type: VoshiLocationType;
  label: string;
};

export type LaunchClaims = {
  launchId: string;
  userId: string;
  memberId: string;
  groups: VoshiUserGroup[];
  courseId: string;
  location: LaunchLocation;
  gradeSubmit: string | null;
  apiToken: string | null;
  exp: number;
};

export type ProvisionClaims = {
  apiToken: string;
  provisionContextUrl: string | null;
  provisionLocationUrl: string | null;
  exp: number;
};

export type LocationsClaims = {
  iss: string;
  contextId: string;
  exp: number;
};

const GROUP_SET = new Set<string>(USER_GROUPS);
const STAFF_GROUP_SET = new Set<string>(STAFF_GROUPS);
const LOCATION_TYPE_SET = new Set<string>(LOCATION_TYPES);

/**
 * True when any group is course staff (manager, instructor, assistant, mentor).
 * @param groups - Role groups from the launch.
 */
export function isCourseStaff(
  groups: readonly string[] | null | undefined,
): boolean {
  if (!groups) {
    return false;
  }
  return groups.some((group) => STAFF_GROUP_SET.has(group));
}

/**
 * True when the person is a student and holds no staff group.
 * @param groups - Role groups from the launch.
 */
export function isPureStudent(
  groups: readonly string[] | null | undefined,
): boolean {
  return Boolean(groups?.includes("student")) && !isCourseStaff(groups);
}

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
 * Narrows an unknown JWT payload to a record, or throws.
 * @param payload - Candidate payload.
 */
function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new VoshiError(
      "Launch token was missing or invalid claims: payload.",
      422,
      "invalid_launch_claims",
    );
  }
  return payload as Record<string, unknown>;
}

/**
 * Reads a nested object claim, or `{}` when missing / not an object.
 * @param raw - Parent record.
 * @param key - Nested claim name.
 */
function readNestedRecord(
  raw: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = raw[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Records `iss` when it is not Voshi's issuer.
 * @param raw - JWT payload.
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readIssuer(raw: Record<string, unknown>, problems: string[]): void {
  if (raw.iss !== VOSHI_ISS) {
    problems.push("iss");
  }
}

/**
 * Reads `exp` as Unix seconds.
 * @param raw - JWT payload.
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readExp(raw: Record<string, unknown>, problems: string[]): number {
  const exp = raw.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    problems.push("exp");
    return 0;
  }
  return exp;
}

/**
 * Reads `api.token`, or "" when it is missing or blank.
 * @param raw - JWT payload.
 */
function readApiToken(raw: Record<string, unknown>): string {
  return trimmedStringOrEmpty(readNestedRecord(raw, "api").token);
}

/**
 * Reads `user.groups`, recording a problem when the list is missing or unknown.
 * @param value - Candidate groups claim.
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readGroups(value: unknown, problems: string[]): VoshiUserGroup[] {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push("user.groups");
    return [];
  }
  const groups: VoshiUserGroup[] = [];
  for (const item of value) {
    if (typeof item === "string" && GROUP_SET.has(item)) {
      groups.push(item as VoshiUserGroup);
      continue;
    }
    const shown = typeof item === "string" ? item : "";
    problems.push(`user.groups (got ${JSON.stringify(shown)})`);
    return groups;
  }
  return groups;
}

/**
 * Reads `grade.submit`. Null and a missing grade claim both mean no column.
 * @param raw - JWT payload.
 */
function readGradeSubmit(raw: Record<string, unknown>): string | null {
  if (!("grade" in raw) || raw.grade == null) {
    return null;
  }
  const grade = readNestedRecord(raw, "grade");
  if (!("submit" in grade) || grade.submit == null) {
    return null;
  }
  return trimmedStringOrEmpty(grade.submit) || null;
}

/**
 * Reads one optional provision URL. Absent or null means that level is not requested.
 * @param provision - `provision` claim object.
 * @param key - `context` or `location`.
 * @param problems - Accumulator of missing/invalid claim names.
 */
function readProvisionUrl(
  provision: Record<string, unknown>,
  key: "context" | "location",
  problems: string[],
): string | null {
  if (!(key in provision) || provision[key] == null) {
    return null;
  }
  const url = trimmedStringOrEmpty(provision[key]);
  if (!url) {
    problems.push(`provision.${key}`);
    return null;
  }
  return url;
}

/**
 * Narrows a verified JWT payload into the launch claims Andy stores.
 * @param payload - Verified JWT payload (do not pass unverified tokens).
 */
export function parseLaunchClaims(payload: unknown): LaunchClaims {
  const raw = asRecord(payload);
  const user = readNestedRecord(raw, "user");
  const course = readNestedRecord(raw, "course");
  const locationRaw = readNestedRecord(raw, "location");

  const problems: string[] = [];
  readIssuer(raw, problems);
  const launchId = readRequiredString(raw.launch_id, "launch_id", problems);
  const userId = readRequiredString(user.id, "user.id", problems);
  const memberId = readRequiredString(user.member, "user.member", problems);
  const groups = readGroups(user.groups, problems);
  const courseId = readRequiredString(course.id, "course.id", problems);
  const locationId = readRequiredString(locationRaw.id, "location.id", problems);
  const locationExtid = readRequiredString(
    locationRaw.extid,
    "location.extid",
    problems,
  );
  const locationType = readAllowedString(
    locationRaw.type,
    "location.type",
    LOCATION_TYPE_SET,
    problems,
  );
  const locationLabel = trimmedStringOrEmpty(locationRaw.label);
  const exp = readExp(raw, problems);
  throwIfInvalidClaims(problems);

  return {
    launchId,
    userId,
    memberId,
    groups,
    courseId,
    location: {
      id: locationId,
      extid: locationExtid,
      type: locationType as VoshiLocationType,
      label: locationLabel || locationExtid || locationType,
    },
    gradeSubmit: readGradeSubmit(raw),
    apiToken: readApiToken(raw) || null,
    exp,
  };
}

/**
 * Narrows a verified provision JWT into the URLs Andy must PUT.
 * @param payload - Verified JWT payload (do not pass unverified tokens).
 */
export function parseProvisionClaims(payload: unknown): ProvisionClaims {
  const raw = asRecord(payload);
  const provision = readNestedRecord(raw, "provision");
  const problems: string[] = [];
  readIssuer(raw, problems);
  const apiToken = readApiToken(raw);
  if (!apiToken) {
    problems.push("api.token");
  }
  const provisionContextUrl = readProvisionUrl(provision, "context", problems);
  const provisionLocationUrl = readProvisionUrl(provision, "location", problems);
  const exp = readExp(raw, problems);
  throwIfInvalidClaims(problems);

  return {
    apiToken,
    provisionContextUrl,
    provisionLocationUrl,
    exp,
  };
}

/**
 * Narrows a verified locations-catalog JWT. The user claim may be null.
 * @param payload - Verified JWT payload (do not pass unverified tokens).
 */
export function parseLocationsClaims(payload: unknown): LocationsClaims {
  const raw = asRecord(payload);
  const problems: string[] = [];
  readIssuer(raw, problems);
  const contextId = readRequiredString(raw.context, "context", problems);
  const exp = readExp(raw, problems);
  throwIfInvalidClaims(problems);
  return {
    iss: VOSHI_ISS,
    contextId,
    exp,
  };
}
