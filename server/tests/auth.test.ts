import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  DEFAULT_RETURN_TO,
  sanitizeReturnTo,
} from "../src/auth/return-to.js";
import {
  buildLoginRedirect,
  readFormString,
  sanitizeLoginMode,
} from "../src/auth/login-url.js";
import {
  isEmailVerificationRequired,
  isOrgSelectionRequired,
  parseWorkOsError,
} from "../src/auth/workos-errors.js";
import { requireAuth } from "../src/auth/middleware.js";
import type { Env } from "../src/config/env.js";

const testEnv = {
  ASSETS: {
    fetch: async () => new Response("not found", { status: 404 }),
  },
} as unknown as Env;

describe("sanitizeReturnTo", () => {
  it("defaults missing or empty values to /author", () => {
    expect(sanitizeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("   ")).toBe(DEFAULT_RETURN_TO);
  });

  it("allows same-origin relative paths", () => {
    expect(sanitizeReturnTo("/author")).toBe("/author");
    expect(sanitizeReturnTo("/lab?x=1")).toBe("/lab?x=1");
  });

  it("rejects open redirects", () => {
    expect(sanitizeReturnTo("//evil.example")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("https://evil.example")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/\\evil")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("author")).toBe(DEFAULT_RETURN_TO);
  });
});

describe("sanitizeLoginMode", () => {
  it("defaults unknown modes to signin", () => {
    expect(sanitizeLoginMode(undefined)).toBe("signin");
    expect(sanitizeLoginMode("nope")).toBe("signin");
  });

  it("accepts known modes", () => {
    expect(sanitizeLoginMode("signup")).toBe("signup");
    expect(sanitizeLoginMode("magic")).toBe("magic");
    expect(sanitizeLoginMode("verify-email")).toBe("verify-email");
  });
});

describe("buildLoginRedirect", () => {
  it("builds a relative /login URL with safe params", () => {
    expect(
      buildLoginRedirect({
        returnTo: "/author",
        mode: "magic",
        email: "a@b.com",
        notice: "Check your email",
      }),
    ).toBe(
      "/login?returnTo=%2Fauthor&mode=magic&email=a%40b.com&notice=Check+your+email",
    );
  });

  it("sanitizes unsafe returnTo values", () => {
    expect(
      buildLoginRedirect({
        returnTo: "https://evil.example",
        error: "Nope",
      }),
    ).toBe("/login?returnTo=%2Fauthor&error=Nope");
  });
});

describe("readFormString", () => {
  it("trims string fields and ignores files", () => {
    expect(readFormString({ email: "  a@b.com " }, "email")).toBe("a@b.com");
    expect(
      readFormString({ email: new File([], "x.txt") }, "email"),
    ).toBe("");
  });
});

describe("parseWorkOsError", () => {
  it("reads AuthenticationException-shaped errors", () => {
    const parsed = parseWorkOsError({
      message: "Email verification required.",
      code: "email_verification_required",
      pendingAuthenticationToken: "pending_abc",
      rawData: {
        email: "a@b.com",
        pending_authentication_token: "pending_abc",
      },
    });

    expect(parsed.code).toBe("email_verification_required");
    expect(parsed.pendingAuthenticationToken).toBe("pending_abc");
    expect(parsed.email).toBe("a@b.com");
    expect(isEmailVerificationRequired(parsed)).toBe(true);
    expect(isOrgSelectionRequired(parsed)).toBe(false);
  });

  it("detects organization_selection_required from rawData", () => {
    const parsed = parseWorkOsError({
      rawData: {
        code: "organization_selection_required",
        pending_authentication_token: "tok",
        organizations: [{ id: "org_1", name: "Andy" }],
      },
    });

    expect(isOrgSelectionRequired(parsed)).toBe(true);
    expect(parsed.organizations).toEqual([{ id: "org_1", name: "Andy" }]);
  });
});

describe("requireAuth", () => {
  it("returns 401 JSON for unauthenticated API requests", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("/api/diagrams/*", requireAuth);
    app.post("/api/diagrams/from-image", (c) => c.json({ ok: true }));

    const res = await app.request(
      "http://localhost/api/diagrams/from-image",
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
      testEnv,
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "unauthorized",
    });
  });

  it("redirects HTML navigations to /login with returnTo", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/author", requireAuth, (c) => c.text("ok"));

    const res = await app.request(
      "http://localhost/author",
      {
        headers: { Accept: "text/html" },
      },
      testEnv,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?returnTo=%2Fauthor",
    );
  });
});
