import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { parseLaunchClaims } from "../src/voshi/claims.js";
import {
  consumeLaunchToken,
  createMemoryReplayStore,
} from "../src/voshi/replay.js";
import { sanitizeLabId, labPathFromExtid } from "../src/voshi/route.js";
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
} from "../src/voshi/grades.js";
import {
  labClientContext,
  serializeLabClientContext,
} from "../src/voshi/context.js";
import { LabPage } from "../src/pages/lab.js";
import { VoshiError } from "../src/voshi/errors.js";
import type { VoshiSession } from "../src/voshi/session.js";
import {
  API_TOKEN,
  COOKIE_PASSWORD,
  launchPayload,
  STUDENT_GRADE_URL,
  studentSession,
  successAttempt,
} from "./voshi-fixtures.js";

describe("lab routing", () => {
  it("sanitizes lab ids", () => {
    expect(sanitizeLabId("doorbell")).toBe("doorbell");
    expect(sanitizeLabId("Single-Pole-Lamp")).toBe("single-pole-lamp");
    expect(sanitizeLabId("../etc/passwd")).toBeNull();
    expect(sanitizeLabId("")).toBeNull();
  });

  it("builds /lab from a location extid", () => {
    expect(labPathFromExtid("doorbell")).toBe("/lab?lab=doorbell");
    expect(labPathFromExtid("Single-Pole-Lamp")).toBe(
      "/lab?lab=single-pole-lamp",
    );
    expect(labPathFromExtid("../etc/passwd")).toBe("/lab");
    expect(labPathFromExtid(undefined)).toBe("/lab");
  });
});

describe("session and grades helpers", () => {
  it("round-trips a sealed session that keeps the grade URL and api token", async () => {
    const claims = parseLaunchClaims(launchPayload);
    const session = sessionFromClaims(claims);
    expect(session).toMatchObject({
      memberId: "Im8mBr42",
      groups: ["student"],
      location: { extid: "doorbell" },
      labId: "doorbell",
      gradeSubmit: STUDENT_GRADE_URL,
      apiToken: API_TOKEN,
    });
    const sealed = await sealVoshiSession(session, COOKIE_PASSWORD);
    await expect(unsealVoshiSession(sealed, COOKIE_PASSWORD)).resolves.toEqual(
      session,
    );
    await expect(unsealVoshiSession("nope", COOKIE_PASSWORD)).resolves.toBeNull();
  });

  it("allows grade passback when a student has a grade URL and api token", () => {
    expect(canSubmitGrade(studentSession())).toBe(true);
    expect(
      canSubmitGrade(studentSession({ groups: ["instructor"] })),
    ).toBe(false);
    expect(
      canSubmitGrade(studentSession({ groups: ["mentor"] })),
    ).toBe(false);
    expect(
      canSubmitGrade(
        studentSession({ groups: ["instructor", "student"] }),
      ),
    ).toBe(true);
    expect(canSubmitGrade(studentSession({ gradeSubmit: null }))).toBe(false);
    expect(canSubmitGrade(studentSession({ apiToken: null }))).toBe(false);
    expect(canSubmitGrade(studentSession({ apiToken: "" }))).toBe(false);
    expect(
      canSubmitGrade(studentSession({ location: { type: "practice" } })),
    ).toBe(true);
    expect(canSubmitGrade(studentSession({ launchId: "" }))).toBe(true);
  });

  it("rejects scores outside 0–1", () => {
    expect(normalizeGradeScore(0)).toBe(0);
    expect(normalizeGradeScore(1)).toBe(1);
    expect(() => normalizeGradeScore(1.2)).toThrow(VoshiError);
    expect(() => normalizeGradeScore("1")).toThrow(VoshiError);
  });

  it("treats only a success attempt as a sent grade", () => {
    const synced = successAttempt();
    expect(requireSyncedGrade(synced)).toBe(synced);
    expect(() =>
      requireSyncedGrade({
        ...synced,
        status: "failed",
        data: { ...synced.data, error: "location has no line item" },
      }),
    ).toThrow(/location has no line item/);
    expect(() => requireSyncedGrade(null)).toThrow(VoshiError);
  });

  it("locks the picker only for a pure student assigned a lab", () => {
    expect(labClientContext(studentSession())).toEqual({
      labId: "doorbell",
      lockPicker: true,
      canGrade: true,
      groups: ["student"],
      locationLabel: "Doorbell",
    });
    expect(
      labClientContext(studentSession({ groups: ["instructor"] })).lockPicker,
    ).toBe(false);
    expect(
      labClientContext(studentSession({ groups: ["instructor", "student"] }))
        .lockPicker,
    ).toBe(false);
    expect(labClientContext(studentSession({ labId: null })).lockPicker).toBe(
      false,
    );
  });

  it("does not put the api token or grade URL in the lab page context", () => {
    const json = serializeLabClientContext(studentSession());
    expect(json).not.toContain(API_TOKEN);
    expect(json).not.toContain(STUDENT_GRADE_URL);
    expect(json).not.toContain("gradeSubmit");
    expect(json).not.toContain("apiToken");
  });
});

describe("lab page for an LMS launch", () => {
  /**
   * Renders the lab shell for a Voshi session.
   * @param session - Session passed to the page, or null for the public lab.
   */
  async function renderLab(session: VoshiSession | null): Promise<string> {
    const app = new Hono();
    app.get("/lab", (c) => c.html(LabPage({ voshi: session }) ?? ""));
    const res = await app.request("http://localhost/lab");
    return res.text();
  }

  it("hides author tools and shows Submit for a pure student who can grade", async () => {
    const html = await renderLab(studentSession());
    expect(html).not.toContain("lab-picker-author");
    expect(html).toContain("voshi-submit-grade");
    expect(html).not.toContain(API_TOKEN);
    expect(html).not.toContain(STUDENT_GRADE_URL);
  });

  it("shows author tools and hides Submit for course staff", async () => {
    const html = await renderLab(studentSession({ groups: ["instructor"] }));
    expect(html).toContain("lab-picker-author");
    expect(html).not.toContain("voshi-submit-grade");
  });

  it("hides Submit when the launch has no grade URL", async () => {
    const html = await renderLab(studentSession({ gradeSubmit: null }));
    expect(html).not.toContain("voshi-submit-grade");
  });

  it("shows author tools on the public lab", async () => {
    const html = await renderLab(null);
    expect(html).toContain("lab-picker-author");
    expect(html).not.toContain("voshi-submit-grade");
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
  it("POSTs the score to grade.submit with the launch api token", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify(successAttempt(0.85)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const grade = await submitVoshiGrade({
      submitUrl: STUDENT_GRADE_URL,
      apiToken: API_TOKEN,
      score: 0.85,
      comment: "Nice work!",
      fetchImpl,
    });

    expect(grade.status).toBe("success");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(STUDENT_GRADE_URL);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: `Bearer ${API_TOKEN}`,
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      score: 0.85,
      comment: "Nice work!",
    });
    expect(String(calls[0].init.headers && JSON.stringify(calls[0].init.headers))).not.toContain(
      "ltiaas_",
    );
  });

  it("maps Voshi 422 to VoshiError", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: "ValidationError",
          message: "score must be between 0 and 1",
        }),
        { status: 422 },
      );
    await expect(
      submitVoshiGrade({
        submitUrl: STUDENT_GRADE_URL,
        apiToken: API_TOKEN,
        score: 1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 422, code: "voshi_grade_rejected" });
  });

  it("rejects a grade call without a submit URL or api token", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("fetch should not be called");
    };
    await expect(
      submitVoshiGrade({
        submitUrl: "",
        apiToken: API_TOKEN,
        score: 1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 422, code: "grade_unavailable" });
    await expect(
      submitVoshiGrade({
        submitUrl: STUDENT_GRADE_URL,
        apiToken: "",
        score: 1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 503, code: "missing_api_token" });
  });
});

