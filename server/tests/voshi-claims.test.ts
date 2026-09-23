import { describe, expect, it } from "vitest";
import {
  parseLaunchClaims,
  parseLocationsClaims,
  parseProvisionClaims,
} from "../src/voshi/claims.js";
import {
  launchPayload,
  locationsPayload,
  nowSeconds,
  PROVISION_CONTEXT_URL,
  PROVISION_LOCATION_URL,
  provisionPayload,
  STUDENT_GRADE_URL,
  API_TOKEN,
  VOSHI_ISS,
} from "./voshi-fixtures.js";

describe("parseLaunchClaims", () => {
  it("reads extid, groups, grade.submit, and api.token", () => {
    const claims = parseLaunchClaims(launchPayload);
    expect(claims.launchId).toBe("I9gbX9ExUrt6");
    expect(claims.userId).toBe("In4kDp7yZq");
    expect(claims.memberId).toBe("Im8mBr42");
    expect(claims.groups).toEqual(["student"]);
    expect(claims.location.extid).toBe("doorbell");
    expect(claims.gradeSubmit).toBe(STUDENT_GRADE_URL);
    expect(claims.apiToken).toBe(API_TOKEN);
    expect(claims).not.toHaveProperty("gradePassback");
    expect(claims.location).not.toHaveProperty("params");
  });

  it("keeps every group when someone is both staff and a student", () => {
    const claims = parseLaunchClaims({
      ...launchPayload,
      user: {
        ...launchPayload.user,
        groups: ["instructor", "student"],
      },
    });
    expect(claims.groups).toEqual(["instructor", "student"]);
  });

  it("treats a null grade.submit as no gradebook column", () => {
    const claims = parseLaunchClaims({
      ...launchPayload,
      grade_passback: true,
      grade: { submit: null },
    });
    expect(claims.gradeSubmit).toBeNull();
  });

  it("treats a missing grade claim as no gradebook column", () => {
    const claims = parseLaunchClaims({
      ...launchPayload,
      grade: undefined,
    });
    expect(claims.gradeSubmit).toBeNull();
  });

  it("rejects the old role, params, and issuer shape", () => {
    expect(() =>
      parseLaunchClaims({
        iss: "https://canvas.instructure.com",
        launch_id: "I9gbX9ExUrt6",
        user: { id: "In4kDp7yZq", role: "student" },
        course: { id: "IcT91mBxze" },
        location: {
          id: "Il0c8n",
          type: "assessment",
          label: "Doorbell",
          params: { lab: "doorbell" },
        },
        grade_passback: true,
        exp: nowSeconds + 7200,
      }),
    ).toThrow(/iss|user\.groups|location\.extid/);
  });

  it("rejects a missing or empty launch_id", () => {
    expect(() =>
      parseLaunchClaims({ ...launchPayload, launch_id: "" }),
    ).toThrow(/launch_id/);
    expect(() =>
      parseLaunchClaims({ ...launchPayload, launch_id: undefined }),
    ).toThrow(/launch_id/);
  });

  it("names missing and invalid claims in the error", () => {
    expect(() =>
      parseLaunchClaims({
        ...launchPayload,
        user: { id: "u", member: "m", groups: ["admin"] },
      }),
    ).toThrow(/user\.groups \(got "admin"\)/);
    expect(() =>
      parseLaunchClaims({
        ...launchPayload,
        user: { id: "u", role: "student" },
      }),
    ).toThrow(/user\.member, user\.groups/);
    expect(() =>
      parseLaunchClaims({
        ...launchPayload,
        iss: "https://canvas.instructure.com",
      }),
    ).toThrow(/iss/);
    expect(() =>
      parseLaunchClaims({
        ...launchPayload,
        course: {},
        location: { type: "quiz" },
      }),
    ).toThrow(/course\.id, location\.id, location\.extid, location\.type \(got "quiz"\)/);
  });
});

describe("provision and locations claims", () => {
  it("reads the provision URLs and ignores copied-course rows", () => {
    const claims = parseProvisionClaims(provisionPayload);
    expect(claims.apiToken).toBe("prov-token");
    expect(claims.provisionContextUrl).toBe(PROVISION_CONTEXT_URL);
    expect(claims.provisionLocationUrl).toBe(PROVISION_LOCATION_URL);
    expect(claims).not.toHaveProperty("parentContext");
  });

  it("allows a location-only provision request", () => {
    const claims = parseProvisionClaims({
      ...provisionPayload,
      provision: { location: PROVISION_LOCATION_URL },
    });
    expect(claims.provisionContextUrl).toBeNull();
    expect(claims.provisionLocationUrl).toBe(PROVISION_LOCATION_URL);
  });

  it("rejects a provision request without an api token", () => {
    expect(() =>
      parseProvisionClaims({
        ...provisionPayload,
        api: { domain: "api.link.voshi.com", token: null },
      }),
    ).toThrow(/api\.token/);
  });

  it("accepts a locations request with no user and a null api token", () => {
    const claims = parseLocationsClaims(locationsPayload);
    expect(claims.iss).toBe(VOSHI_ISS);
    expect(claims.contextId).toBe("IcT91mBxze");
    expect(claims).not.toHaveProperty("launchId");
  });

  it("rejects a locations request with the wrong issuer", () => {
    expect(() =>
      parseLocationsClaims({
        ...locationsPayload,
        iss: "https://canvas.instructure.com",
      }),
    ).toThrow(/iss/);
  });
});

