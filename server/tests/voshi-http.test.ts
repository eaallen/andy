import { describe, expect, it, beforeAll } from "vitest";
import { Hono } from "hono";
import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import { verifyLaunchJwt } from "../src/voshi/verify.js";
import { createMemoryReplayStore } from "../src/voshi/replay.js";
import { completeLaunch } from "../src/voshi/launch.js";
import { voshiRoutes } from "../src/routes/voshi.js";
import type { Env } from "../src/config/env.js";
import {
  API_TOKEN,
  LAB_CATALOG,
  launchPayload,
  locationsPayload,
  nowSeconds,
  PROVISION_CONTEXT_URL,
  PROVISION_LOCATION_URL,
  provisionPayload,
  STUDENT_GRADE_URL,
  successAttempt,
  testEnv,
} from "./voshi-fixtures.js";

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

  /**
   * Signs a payload with the test RS256 key.
   * @param payload - JWT claims.
   * @param header - Protected header.
   */
  async function signLaunch(
    payload: Record<string, unknown> = launchPayload,
    header: Record<string, string> = { alg: "RS256", kid: "test-key" },
  ): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(privateKey);
  }

  /**
   * POSTs a form body with launch_data to a Voshi route.
   * @param app - Hono app under test.
   * @param path - Route path.
   * @param token - Raw JWT, or null to omit the field.
   */
  function postForm(
    app: Hono<{ Bindings: Env }>,
    path: string,
    token: string | null,
  ) {
    const body =
      token === null ? "" : `launch_data=${encodeURIComponent(token)}`;
    return app.request(
      `http://localhost${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      testEnv(),
    );
  }

  it("verifies RS256 and returns claims", async () => {
    const token = await signLaunch();
    const claims = await verifyLaunchJwt(token, getKey);
    expect(claims.launchId).toBe("I9gbX9ExUrt6");
    expect(claims.location.extid).toBe("doorbell");
    expect(claims.gradeSubmit).toBe(STUDENT_GRADE_URL);
  });

  it("rejects a token whose issuer is not Voshi", async () => {
    const token = await signLaunch({
      ...launchPayload,
      iss: "https://canvas.instructure.com",
    });
    await expect(verifyLaunchJwt(token, getKey)).rejects.toMatchObject({
      code: "invalid_launch",
      status: 401,
    });
  });

  it("rejects expired tokens", async () => {
    const token = await signLaunch({
      ...launchPayload,
      iat: nowSeconds - 100,
      exp: nowSeconds - 10,
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

  it("exchanges a launch token once and redirects to the lab extid", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const result = await completeLaunch(token, replay, getKey);
    expect(result.redirectTo).toBe("/lab?lab=doorbell");
    expect(result.session.userId).toBe("In4kDp7yZq");
    expect(result.session.gradeSubmit).toBe(STUDENT_GRADE_URL);
    expect(result.session.apiToken).toBe(API_TOKEN);
    await expect(completeLaunch(token, replay, getKey)).rejects.toMatchObject({
      code: "launch_replay",
    });
  });

  it("redirects an invalid extid to the lab picker", async () => {
    const token = await signLaunch({
      ...launchPayload,
      location: { ...launchPayload.location, extid: "../etc/passwd" },
    });
    const result = await completeLaunch(
      token,
      createMemoryReplayStore(),
      getKey,
    );
    expect(result.redirectTo).toBe("/lab");
    expect(result.session.labId).toBeNull();
  });

  it("POST /launch sets a session cookie and redirects", async () => {
    const token = await signLaunch();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/launch", token);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/lab?lab=doorbell");
    expect(res.headers.get("set-cookie")).toMatch(/voshi-session=/);
  });

  it("POST /launch without launch_data returns 422 HTML", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/launch", null);

    expect(res.status).toBe(422);
    expect(await res.text()).toMatch(/Missing launch_data/);
  });

  it("POSTs a student score to the launch grade URL with the api token", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify(successAttempt(1)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay, fetchImpl }));

    const launchRes = await postForm(app, "/launch", token);
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
    await expect(gradeRes.json()).resolves.toEqual({
      ok: true,
      score: 1,
      status: "success",
    });
    expect(calls[0].url).toBe(STUDENT_GRADE_URL);
    expect(calls[0].init.headers).toMatchObject({
      Authorization: `Bearer ${API_TOKEN}`,
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ score: 1 });
  });

  it("rejects a launch token with an empty launch_id", async () => {
    const token = await signLaunch({ ...launchPayload, launch_id: "" });
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/launch", token);

    expect(res.status).toBe(422);
    expect(await res.text()).toMatch(/launch_id/);
  });

  it("defaults a missing grade score to 0", async () => {
    const token = await signLaunch();
    const replay = createMemoryReplayStore();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify(successAttempt(0)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay, fetchImpl }));

    const launchRes = await postForm(app, "/launch", token);
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
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ score: 0 });
  });

  it("does not return ok when the LMS rejects the attempt", async () => {
    const token = await signLaunch();
    const failed = successAttempt(1);
    failed.status = "failed";
    failed.data = { ...failed.data, error: "location has no line item" };
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(failed), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({
        getKey,
        replay: createMemoryReplayStore(),
        fetchImpl,
      }),
    );

    const launchRes = await postForm(app, "/launch", token);
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
      error: "location has no line item",
    });
  });

  it("does not grade staff launches", async () => {
    const token = await signLaunch({
      ...launchPayload,
      user: { ...launchPayload.user, id: "instr", groups: ["instructor"] },
      grade: {
        submit:
          "https://api.link.voshi.com/lti13/v1/contexts/IcT91mBxze/members/Im8mBr42/apps/I4ppXy/locations/ext:doorbell/grade",
      },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const launchRes = await postForm(app, "/launch", token);
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

  it("does not grade a student launch with a null grade URL", async () => {
    const token = await signLaunch({
      ...launchPayload,
      grade: { submit: null },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const launchRes = await postForm(app, "/launch", token);
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

  it("PUT provision URLs in order and then returns 204", async () => {
    const token = await signLaunch(provisionPayload);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(null, { status: 204 });
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore(), fetchImpl }),
    );

    const res = await postForm(app, "/voshi/provision", token);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["PUT", PROVISION_CONTEXT_URL],
      ["PUT", PROVISION_LOCATION_URL],
    ]);
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer prov-token",
    });
    expect(calls[0].init.body ?? null).toBeNull();
    expect(calls[1].init.body ?? null).toBeNull();
  });

  it("does not read parent course storage while provisioning", async () => {
    const token = await signLaunch(provisionPayload);
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push(`${init?.method || "GET"} ${String(url)}`);
      return new Response(null, { status: 204 });
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore(), fetchImpl }),
    );

    const res = await postForm(app, "/voshi/provision", token);

    expect(res.status).toBe(204);
    expect(calls.some((call) => call.includes("Ic0pI3dFr0m"))).toBe(false);
  });

  it("provisions a location without a context URL", async () => {
    const token = await signLaunch({
      ...provisionPayload,
      provision: { location: PROVISION_LOCATION_URL },
    });
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(null, { status: 204 });
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore(), fetchImpl }),
    );

    const res = await postForm(app, "/voshi/provision", token);

    expect(res.status).toBe(204);
    expect(calls.map((call) => call.url)).toEqual([PROVISION_LOCATION_URL]);
  });

  it("returns 503 and stops when a provision PUT fails", async () => {
    const token = await signLaunch(provisionPayload);
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ message: "forbidden" }), {
        status: 403,
      });
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore(), fetchImpl }),
    );

    const res = await postForm(app, "/voshi/provision", token);

    expect(res.status).toBe(503);
    expect(calls).toEqual([PROVISION_CONTEXT_URL]);
  });

  it("rejects a replayed provision token", async () => {
    const token = await signLaunch(provisionPayload);
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 204 });
    const app = new Hono<{ Bindings: Env }>();
    app.route(
      "/",
      voshiRoutes({ getKey, replay: createMemoryReplayStore(), fetchImpl }),
    );

    expect((await postForm(app, "/voshi/provision", token)).status).toBe(204);
    const again = await postForm(app, "/voshi/provision", token);
    expect(again.status).toBe(401);
    expect(await again.text()).toMatch(/already been used/);
  });

  it("serves the lab catalog from POST /voshi/locations", async () => {
    const token = await signLaunch(locationsPayload);
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/voshi/locations", token);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.locations)).toEqual(Object.keys(LAB_CATALOG));
    expect(body.locations).toEqual(LAB_CATALOG);
    expect(JSON.stringify(body)).not.toContain("draft");
  });

  it("serves the same catalog when the locations user is present", async () => {
    const token = await signLaunch({
      ...locationsPayload,
      user: {
        id: "In4kDp7yZq",
        member: "Im8mBr42",
        groups: ["instructor"],
        email: "ada@example.edu",
      },
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/voshi/locations", token);
    const body = await res.json();
    expect(body.locations).toEqual(LAB_CATALOG);
  });

  it("rejects an unverified locations token", async () => {
    const token = await new SignJWT(locationsPayload)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("not-an-rsa-secret-at-all!!"));
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/voshi/locations", token);
    expect(res.status).toBe(401);
  });

  it("rejects a locations request without launch_data", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/", voshiRoutes({ getKey, replay: createMemoryReplayStore() }));

    const res = await postForm(app, "/voshi/locations", null);
    expect(res.status).toBe(422);
  });
});
