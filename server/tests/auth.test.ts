import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  DEFAULT_RETURN_TO,
  sanitizeReturnTo,
} from "../src/auth/return-to.js";
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
