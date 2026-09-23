import type { Env } from "../src/config/env.js";
import { voshiLocationsCatalog } from "../src/lab/graded-labs.js";
import type { VoshiSession } from "../src/voshi/session.js";

export const COOKIE_PASSWORD = "c".repeat(32);
export const VOSHI_ISS = "https://api.link.voshi.com";
export const API_TOKEN = "8f14e45fceea167a5a36dedd4bea2543";
export const STUDENT_GRADE_URL =
  "https://api.link.voshi.com/account/v1/users/In4kDp7yZq/contexts/IcT91mBxze/locations/ext:doorbell/grade";
export const PROVISION_CONTEXT_URL =
  "https://api.link.voshi.com/lti13/v1/contexts/IcT91mBxze/apps/I4ppXy/provision";
export const PROVISION_LOCATION_URL =
  "https://api.link.voshi.com/lti13/v1/contexts/IcT91mBxze/apps/I4ppXy/locations/ext:doorbell/provision";

export const nowSeconds = Math.floor(Date.now() / 1000);

export const launchPayload = {
  iat: nowSeconds,
  exp: nowSeconds + 7200,
  iss: VOSHI_ISS,
  api: { domain: "api.link.voshi.com", token: API_TOKEN },
  launch_id: "I9gbX9ExUrt6",
  user: {
    id: "In4kDp7yZq",
    member: "Im8mBr42",
    groups: ["student"],
  },
  course: { id: "IcT91mBxze", name: "Intro", label: "CS101" },
  context: "IcT91mBxze",
  location: {
    id: "Il0c8n",
    extid: "doorbell",
    type: "assessment",
    label: "Doorbell",
  },
  grade: { submit: STUDENT_GRADE_URL },
};

export const provisionPayload = {
  iat: nowSeconds,
  exp: nowSeconds + 7200,
  iss: VOSHI_ISS,
  api: { domain: "api.link.voshi.com", token: "prov-token" },
  app: "I4ppXy",
  context: "IcT91mBxze",
  user: {
    id: "In4kDp7yZq",
    member: "Im8mBr42",
    groups: ["instructor"],
  },
  course: { id: "IcT91mBxze", name: "Intro", label: "CS101" },
  location: {
    id: "Il0c8n",
    extid: "doorbell",
    type: "assessment",
    label: "Doorbell",
  },
  provision: {
    context: PROVISION_CONTEXT_URL,
    location: PROVISION_LOCATION_URL,
  },
  parent_context: "Ic0pI3dFr0m",
  storage: {
    parent_context:
      "https://api.link.voshi.com/lti13/v1/contexts/Ic0pI3dFr0m/apps/I4ppXy/data",
    parent_location:
      "https://api.link.voshi.com/lti13/v1/contexts/Ic0pI3dFr0m/apps/I4ppXy/locations/ext:doorbell/data",
  },
};

export const locationsPayload = {
  iat: nowSeconds,
  exp: nowSeconds + 7200,
  iss: VOSHI_ISS,
  api: { domain: "api.link.voshi.com", token: null },
  app: "I4ppXy",
  context: "IcT91mBxze",
  user: null,
};

export const LAB_CATALOG = voshiLocationsCatalog();

/**
 * Builds a Worker env binding bag for route tests.
 * @param overrides - Optional env overrides.
 */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return {
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    },
    AI_PROVIDER: "demo",
    VOSHI_COOKIE_PASSWORD: COOKIE_PASSWORD,
    VOSHI_API_KEY: "ltiaas_test_secret",
    ...overrides,
  } as unknown as Env;
}

/**
 * Builds a sealed-session-shaped student launch for helper/page tests.
 * @param overrides - Partial session fields to overlay (location merges).
 */
export function studentSession(
  overrides: Partial<VoshiSession> = {},
): VoshiSession {
  const base: VoshiSession = {
    launchId: "I9gbX9ExUrt6",
    userId: "In4kDp7yZq",
    memberId: "Im8mBr42",
    groups: ["student"],
    courseId: "IcT91mBxze",
    location: {
      id: "Il0c8n",
      extid: "doorbell",
      type: "assessment",
      label: "Doorbell",
    },
    labId: "doorbell",
    gradeSubmit: STUDENT_GRADE_URL,
    apiToken: API_TOKEN,
  };
  return {
    ...base,
    ...overrides,
    location: {
      ...base.location,
      ...(overrides.location ?? {}),
    },
  };
}

/**
 * Builds a successful Voshi grade attempt body.
 * @param score - Score fraction.
 */
export function successAttempt(score = 1) {
  return {
    id: "Igp8dEx",
    status: "success" as const,
    score,
    max_score: null,
    activity_progress: "Completed",
    grading_progress: "FullyGraded",
    submitted: "2026-09-21T18:10:00+00:00",
    member: "Im8mBr42",
    location: "Il0c8n",
    app: "I4ppXy",
    context: "IcT91mBxze",
    data: {
      comment: "",
      response: { status: 200, body: "" },
      error: "",
      source_type: "session",
      source_id: "In4kDp7yZq",
    },
  };
}
