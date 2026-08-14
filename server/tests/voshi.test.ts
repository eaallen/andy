import { describe, expect, it, beforeAll } from "vitest";
import { Hono } from "hono";
import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import { parseLaunchClaims } from "../src/voshi/claims.js";
import { verifyLaunchJwt } from "../src/voshi/verify.js";
import {
  consumeLaunchToken,
  createMemoryReplayStore,
} from "../src/voshi/replay.js";
import { labPathFromParams, sanitizeLabId } from "../src/voshi/route.js";
import {
  sealVoshiSession,
  sessionFromClaims,
  unsealVoshiSession,
} from "../src/voshi/session.js";
import {
  canSubmitGrade,
  normalizeGradeScore,
  requireSyncedGrade,
  submitVoshiGrade,
  type VoshiGradeResult,
} from "../src/voshi/grades.js";
import { completeLaunch } from "../src/voshi/launch.js";
import { labClientContext } from "../src/voshi/context.js";
import { voshiRoutes } from "../src/routes/voshi.js";
import { VoshiError } from "../src/voshi/errors.js";
import type { Env } from "../src/config/env.js";
import type { VoshiSession } from "../src/voshi/session.js";

const COOKIE_PASSWORD = "c".repeat(32);

const launchPayload = {
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 7200,
  iss: "https://canvas.instructure.com",
  launch_id: "I9gbX9ExUrt6",
  user: { id: "In4kDp7yZq", role: "student" },
  course: { id: "IcT91mBxze", name: "Intro", label: "CS101" },
  location: {
    id: "Il0c8n",
    type: "assessment",
    label: "Doorbell",
    params: { lab: "doorbell" },
  },
  grade_passback: true,
};

function testEnv(overrides: Record<string, string> = {}): Env {
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

function studentSession(
  overrides: Partial<VoshiSession> = {},
): VoshiSession {
  return {
    launchId: "I9gbX9ExUrt6",
    userId: "In4kDp7yZq",
    role: "student",
    courseId: "IcT91mBxze",
    locationId: "Il0c8n",
    locationType: "assessment",
    locationLabel: "Doorbell",
    labId: "doorbell",
    gradePassback: true,
    ...overrides,
  };
}

describe("parseLaunchClaims", () => {
  it("reads required claims and string params", () => {
    const claims = parseLaunchClaims(launchPayload);
    expect(claims.launchId).toBe("I9gbX9ExUrt6");
    expect(claims.userId).toBe("In4kDp7yZq");
    expect(claims.role).toBe("student");
    expect(claims.gradePassback).toBe(true);
    expect(claims.location.params).toEqual({ lab: "doorbell" });
  });

  it("treats missing grade_passback as false", () => {
    const claims = parseLaunchClaims({
      ...launchPayload,
      grade_passback: false,
    });
    expect(claims.gradePassback).toBe(false);
  });

  it("drops non-string location params", () => {
    const claims = parseLaunchClaims({
      ...launchPayload,
      location: {
        ...launchPayload.location,
        params: { lab: "doorbell", chapter: 3 },
      },
    });
    expect(claims.location.params).toEqual({ lab: "doorbell" });
  });

  it("names missing and invalid claims in the error", () => {
    expect(() =>
      parseLaunchClaims({ ...launchPayload, user: { id: "u", role: "ta" } }),
    ).toThrow(/user\.role \(got "ta"\)/);
    expect(() =>
      parseLaunchClaims({ ...launchPayload, launch_id: "" }),
    ).toThrow(/launch_id/);
    expect(() =>
      parseLaunchClaims({
        ...launchPayload,
        launch_id: "",
        course: {},
        location: { type: "quiz" },
      }),
    ).toThrow(
      /launch_id, course\.id, location\.id, location\.type \(got "quiz"\)/,
    );
  });
});

describe("lab routing", () => {
  it("sanitizes lab ids", () => {
    expect(sanitizeLabId("doorbell")).toBe("doorbell");
    expect(sanitizeLabId("Single-Pole-Lamp")).toBe("single-pole-lamp");
    expect(sanitizeLabId("../etc/passwd")).toBeNull();
    expect(sanitizeLabId("")).toBeNull();
  });

  it("builds /lab from location params", () => {
    expect(labPathFromParams({ lab: "doorbell" })).toBe("/lab?lab=doorbell");
    expect(labPathFromParams({})).toBe("/lab");
  });
});

describe("session and grades helpers", () => {
  it("round-trips a sealed session cookie", async () => {
    const claims = parseLaunchClaims(launchPayload);
    const session = sessionFromClaims(claims);
    const sealed = await sealVoshiSession(session, COOKIE_PASSWORD);
    await expect(
      unsealVoshiSession(sealed, COOKIE_PASSWORD),
    ).resolves.toEqual(session);
    await expect(unsealVoshiSession("nope", COOKIE_PASSWORD)).resolves.toBeNull();
  });

  it("allows grade passback only for student assessment launches", () => {
    expect(canSubmitGrade(studentSession())).toBe(true);
    expect(canSubmitGrade(studentSession({ role: "instructor" }))).toBe(false);
    expect(canSubmitGrade(studentSession({ gradePassback: false }))).toBe(
      false,
    );
    expect(
      canSubmitGrade(studentSession({ locationType: "practice" })),
    ).toBe(false);
  });

  it("rejects scores outside 0–1", () => {
    expect(normalizeGradeScore(0)).toBe(0);
    expect(normalizeGradeScore(1)).toBe(1);
    expect(() => normalizeGradeScore(1.2)).toThrow(VoshiError);
    expect(() => normalizeGradeScore("1")).toThrow(VoshiError);
  });

  it("treats only a synced LMS grade as success", () => {
    const synced: VoshiGradeResult = {
      grade_id: "Gr8dEx",
      launch_id: "I9gbX9ExUrt6",
      score: 1,
      sync_status: "synced",
      sync_error: null,
      submitted_at: "2026-07-27T18:10:00+00:00",
      synced_at: "2026-07-27T18:10:01+00:00",
    };
    expect(requireSyncedGrade(synced)).toBe(synced);
    expect(() =>
      requireSyncedGrade({
        ...synced,
        sync_status: "failed",
        sync_error: "LMS rejected the score.",
      }),
    ).toThrow(/LMS rejected the score/);
    expect(() =>
      requireSyncedGrade({ ...synced, sync_status: "pending" }),
    ).toThrow(VoshiError);
    expect(() => requireSyncedGrade(null)).toThrow(VoshiError);
  });

  it("locks the picker for students assigned a lab", () => {
    expect(labClientContext(studentSession()).lockPicker).toBe(true);
    expect(labClientContext(studentSession()).canGrade).toBe(true);
    expect(
      labClientContext(studentSession({ role: "instructor" })).lockPicker,
    ).toBe(false);
    expect(labClientContext(studentSession({ labId: null })).lockPicker).toBe(
      false,
    );
  });
});

describe("replay store", () => {
  it("rejects the same token twice until expiry", async () => {
    const store = createMemoryReplayStore();
    const exp = Math.floor(Date.now() / 1000) + 60;
    await consumeLaunchToken("token-a", exp, store);
    await expect(consumeLaunchToken("token-a", exp, store)).rejects.toMatchObject(
      { code: "launch_replay", status: 401 },
    );
    await consumeLaunchToken("token-b", exp, store);
  });
});

describe("submitVoshiGrade", () => {
  it("POSTs the app API key and score fraction", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(
        JSON.stringify({
          grade_id: "Gr8dEx",
          launch_id: "I9gbX9ExUrt6",
          score: 0.85,
          sync_status: "synced",
          sync_error: null,
          submitted_at: "2026-07-27T18:10:00+00:00",
          synced_at: "2026-07-27T18:10:01+00:00",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const grade = await submitVoshiGrade({
      apiKey: "ltiaas_app_secret",
      launchId: "I9gbX9ExUrt6",
      score: 0.85,
      fetchImpl,
    });

    expect(grade.sync_status).toBe("synced");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.link.voshi.com/ltiaas/v1/grades");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer ltiaas_app_secret",
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      launch_id: "I9gbX9ExUrt6",
      score: 0.85,
    });
  });

  it("maps Voshi 422 to VoshiError", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "no line item" }), {
        status: 422,
      });
    await expect(
      submitVoshiGrade({
        apiKey: "ltiaas_app_secret",
        launchId: "nope",
        score: 1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 422, code: "voshi_grade_rejected" });
  });
});

describe("JWT verify + launch receiver", () => {
  let getKey: JWTVerifyGetKey;
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const jwk = await exportJWK(pair.publicKey);
    jwk.kid = "test-key";
    jwk.alg = "RS256";
    getKey = createLocalJWKSet({ keys: [jwk] });
  });

  async function signLaunch(
    payload: Record<string, unknown> = launchPayload,
    header: Record<string, string> = { alg: "RS256", kid: "test-key" },
  ): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(privateKey);
  }

  it("verifies RS256 and returns claims", async () => {
    const token = await signLaunch();
    const claims = await verifyLaunchJwt(token, getKey);
    expect(claims.launchId).toBe("I9gbX9ExUrt6");
    expect(claims.location.params.lab).toBe("doorbell");
  });

  it("rejects expired tokens", async () => {
    const token = await signLaunch({
      ...launchPayload,
      iat: Math.floor(Date.now() / 1000) - 100,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(verifyLaunchJwt(token, getKey)).rejects.toMatchObject({
      code: "invalid_launch",
      status: 401,
    });
  });

  it("rejects tokens that are not RS256", async () => {
    const token = await new SignJWT(launchPayload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("not-an-rsa-secret-at-all!!"));
    await expect(verifyLaunchJwt(token, getKey)).rejects.toMatchObject({
      code: "invalid_launch",
    });
  });

  it("exchanges a launch token once and redirects to the lab", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const result = await completeLaunch(token, replay, getKey);
    expect(result.redirectTo).toBe("/lab?lab=doorbell");
    expect(result.session.userId).toBe("In4kDp7yZq");
    await expect(completeLaunch(token, replay, getKey)).rejects.toMatchObject({
      code: "launch_replay",
    });
  });

  it("POST /launch sets a session cookie and redirects", async () => {
    const token = await signLaunch();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `launch_data=${encodeURIComponent(token)}`,
      },
      testEnv(),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/lab?lab=doorbell");
    expect(res.headers.get("set-cookie")).toMatch(/voshi-session=/);
  });

  it("POST /launch without launch_data returns 422 HTML", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "",
      },
      testEnv(),
    );

    expect(res.status).toBe(422);
    expect(await res.text()).toMatch(/Missing launch_data/);
  });

  it("POSTs a grade for a student assessment launch", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          grade_id: "Gr8dEx",
          launch_id: "I9gbX9ExUrt6",
          score: 1,
          sync_status: "synced",
          sync_error: null,
          submitted_at: "2026-07-27T18:10:00+00:00",
          synced_at: "2026-07-27T18:10:01+00:00",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay, fetchImpl }));

    const launchRes = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `launch_data=${encodeURIComponent(token)}`,
      },
      testEnv(),
    );
    const cookie = launchRes.headers.get("set-cookie")?.split(";")[0] || "";

    const gradeRes = await app.request(
      "http://localhost/api/voshi/grade",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ score: 1 }),
      },
      testEnv(),
    );

    expect(gradeRes.status).toBe(200);
    await expect(gradeRes.json()).resolves.toMatchObject({
      ok: true,
      score: 1,
      syncStatus: "synced",
    });
  });

  it("defaults a missing grade score to 0", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(
        JSON.stringify({
          grade_id: "Gr8dEx",
          launch_id: "I9gbX9ExUrt6",
          score: 0,
          sync_status: "synced",
          sync_error: null,
          submitted_at: "2026-07-27T18:10:00+00:00",
          synced_at: "2026-07-27T18:10:01+00:00",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay, fetchImpl }));

    const launchRes = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `launch_data=${encodeURIComponent(token)}`,
      },
      testEnv(),
    );
    const cookie = launchRes.headers.get("set-cookie")?.split(";")[0] || "";

    const gradeRes = await app.request(
      "http://localhost/api/voshi/grade",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({}),
      },
      testEnv(),
    );

    expect(gradeRes.status).toBe(200);
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      score: 0,
    });
  });

  it("does not return ok when LMS sync failed", async () => {
    const token = await signLaunch();
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          grade_id: "Gr8dEx",
          launch_id: "I9gbX9ExUrt6",
          score: 1,
          sync_status: "failed",
          sync_error: "LMS rejected the score.",
          submitted_at: "2026-07-27T18:10:00+00:00",
          synced_at: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({
        getKey,
        replay: createMemoryReplayStore(),
        fetchImpl,
      }),
    );

    const launchRes = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `launch_data=${encodeURIComponent(token)}`,
      },
      testEnv(),
    );
    const cookie = launchRes.headers.get("set-cookie")?.split(";")[0] || "";

    const gradeRes = await app.request(
      "http://localhost/api/voshi/grade",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ score: 1 }),
      },
      testEnv(),
    );

    expect(gradeRes.status).toBe(503);
    await expect(gradeRes.json()).resolves.toMatchObject({
      code: "voshi_grade_failed",
      error: "LMS rejected the score.",
    });
  });

  it("does not grade instructor launches", async () => {
    const token = await signLaunch({
      ...launchPayload,
      user: { id: "instr", role: "instructor" },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore() }),
    );

    const launchRes = await app.request(
      "http://localhost/launch",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `launch_data=${encodeURIComponent(token)}`,
      },
      testEnv(),
    );
    const cookie = launchRes.headers.get("set-cookie")?.split(";")[0] || "";

    const gradeRes = await app.request(
      "http://localhost/api/voshi/grade",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ score: 1 }),
      },
      testEnv(),
    );

    expect(gradeRes.status).toBe(422);
    await expect(gradeRes.json()).resolves.toMatchObject({
      code: "grade_unavailable",
    });
  });
});
