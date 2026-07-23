import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppConfig, Env } from "@/config/env.js";
import { assertWorkosConfigured, getAppConfig } from "@/config/env.js";
import { sanitizeReturnTo } from "@/auth/return-to.js";
import {
  buildLoginRedirect,
  readFormString,
  sanitizeLoginMode,
} from "@/auth/login-url.js";
import {
  isEmailVerificationRequired,
  isOrgSelectionRequired,
  parseWorkOsError,
} from "@/auth/workos-errors.js";
import { getSessionUser } from "@/auth/session.js";
import {
  getRedirectUri,
  getWorkOS,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/auth/workos.js";
import { LoginPage } from "@/pages/login.js";

type AppEnv = {
  Bindings: Env;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Variables: any;
};

export const authRoutes = new Hono<AppEnv>();

/**
 * Session sealing options for WorkOS authenticate* calls.
 * @param config - Normalized app config.
 */
function sessionSeal(config: AppConfig) {
  return {
    sealSession: true as const,
    cookiePassword: config.workosCookiePassword,
  };
}

/**
 * Sets the sealed session cookie on the response.
 * @param c - Hono context.
 * @param sealedSession - Encrypted WorkOS session payload.
 */
function setSessionCookie(c: Context<AppEnv>, sealedSession: string): void {
  setCookie(
    c,
    SESSION_COOKIE,
    sealedSession,
    sessionCookieOptions(new URL(c.req.url)),
  );
}

type AuthAttemptResult =
  | { ok: true; sealedSession: string }
  | {
      ok: false;
      kind: "verify-email";
      email: string;
      pendingToken: string;
      message: string;
    }
  | { ok: false; kind: "error"; message: string };

/**
 * Resolves a WorkOS authenticate* result, including org / email-verify steps.
 * @param env - Worker env (for WorkOS client).
 * @param config - Normalized app config.
 * @param emailHint - Email shown on the verify-email step.
 * @param authenticate - Function that performs the primary authenticate call.
 */
async function resolveAuthAttempt(
  env: Env,
  config: AppConfig,
  emailHint: string,
  authenticate: () => Promise<{ sealedSession?: string | null }>,
): Promise<AuthAttemptResult> {
  try {
    const result = await authenticate();
    if (!result.sealedSession) {
      return { ok: false, kind: "error", message: "Authentication failed." };
    }
    return { ok: true, sealedSession: result.sealedSession };
  } catch (err) {
    const parsed = parseWorkOsError(err);

    if (
      isOrgSelectionRequired(parsed) &&
      parsed.pendingAuthenticationToken &&
      config.workosOrganizationId
    ) {
      try {
        const workos = getWorkOS(env);
        const result =
          await workos.userManagement.authenticateWithOrganizationSelection({
            clientId: config.workosClientId,
            pendingAuthenticationToken: parsed.pendingAuthenticationToken,
            organizationId: config.workosOrganizationId,
            session: sessionSeal(config),
          });
        if (!result.sealedSession) {
          return {
            ok: false,
            kind: "error",
            message: "Authentication failed.",
          };
        }
        return { ok: true, sealedSession: result.sealedSession };
      } catch (orgErr) {
        const orgParsed = parseWorkOsError(orgErr);
        return {
          ok: false,
          kind: "error",
          message: orgParsed.message || "Could not select organization.",
        };
      }
    }

    if (
      isEmailVerificationRequired(parsed) &&
      parsed.pendingAuthenticationToken
    ) {
      return {
        ok: false,
        kind: "verify-email",
        email: parsed.email || emailHint,
        pendingToken: parsed.pendingAuthenticationToken,
        message:
          parsed.message ||
          "Enter the verification code we sent to your email.",
      };
    }

    return {
      ok: false,
      kind: "error",
      message: parsed.message || "Authentication failed.",
    };
  }
}

/**
 * Redirects to the login page for a failed attempt (error or verify-email).
 * @param returnTo - Safe return path.
 * @param email - Email associated with the attempt.
 * @param result - Failed auth attempt result.
 */
function redirectAuthFailure(
  returnTo: string,
  email: string,
  result: Extract<AuthAttemptResult, { ok: false }>,
) {
  if (result.kind === "verify-email") {
    return buildLoginRedirect({
      returnTo,
      mode: "verify-email",
      email: result.email || email,
      pendingToken: result.pendingToken,
      notice: result.message,
    });
  }
  return buildLoginRedirect({
    returnTo,
    email,
    error: result.message,
  });
}

/**
 * GET /login — on-site sign-in / sign-up UI (WorkOS headless APIs).
 */
authRoutes.get("/login", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const user = await getSessionUser(c);
  const returnTo = sanitizeReturnTo(c.req.query("returnTo"));
  if (user) {
    return c.redirect(returnTo);
  }

  return c.html(
    <LoginPage
      mode={sanitizeLoginMode(c.req.query("mode"))}
      returnTo={returnTo}
      email={c.req.query("email") || ""}
      error={c.req.query("error")}
      notice={c.req.query("notice")}
      pendingToken={c.req.query("pendingToken") || ""}
      user={user}
    />,
  );
});

/**
 * POST /login — email + password authentication.
 */
authRoutes.post("/login", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const body = await c.req.parseBody();
  const email = readFormString(body, "email");
  const password = readFormString(body, "password");
  const returnTo = sanitizeReturnTo(readFormString(body, "returnTo"));

  if (!email || !password) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        email,
        error: "Email and password are required.",
      }),
    );
  }

  const workos = getWorkOS(c.env);
  const attempt = await resolveAuthAttempt(c.env, config, email, () =>
    workos.userManagement.authenticateWithPassword({
      clientId: config.workosClientId,
      email,
      password,
      session: sessionSeal(config),
    }),
  );

  if (!attempt.ok) {
    return c.redirect(redirectAuthFailure(returnTo, email, attempt));
  }

  setSessionCookie(c, attempt.sealedSession);
  return c.redirect(returnTo);
});

/**
 * POST /signup — create a WorkOS user, then sign them in.
 */
authRoutes.post("/signup", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const body = await c.req.parseBody();
  const email = readFormString(body, "email");
  const password = readFormString(body, "password");
  const returnTo = sanitizeReturnTo(readFormString(body, "returnTo"));

  if (!email || !password) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "signup",
        email,
        error: "Email and password are required.",
      }),
    );
  }
  if (password.length < 8) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "signup",
        email,
        error: "Password must be at least 8 characters.",
      }),
    );
  }

  const workos = getWorkOS(c.env);

  try {
    const created = await workos.userManagement.createUser({
      email,
      password,
    });

    if (config.workosOrganizationId) {
      try {
        await workos.userManagement.createOrganizationMembership({
          userId: created.id,
          organizationId: config.workosOrganizationId,
        });
      } catch (membershipErr) {
        console.error(
          "[andy-server] org membership after signup failed:",
          membershipErr,
        );
      }
    }
  } catch (err) {
    const parsed = parseWorkOsError(err);
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "signup",
        email,
        error: parsed.message || "Could not create account.",
      }),
    );
  }

  const attempt = await resolveAuthAttempt(c.env, config, email, () =>
    workos.userManagement.authenticateWithPassword({
      clientId: config.workosClientId,
      email,
      password,
      session: sessionSeal(config),
    }),
  );

  if (!attempt.ok) {
    if (attempt.kind === "verify-email") {
      return c.redirect(redirectAuthFailure(returnTo, email, attempt));
    }
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "signup",
        email,
        error: attempt.message,
      }),
    );
  }

  setSessionCookie(c, attempt.sealedSession);
  return c.redirect(returnTo);
});

/**
 * POST /login/magic — send a Magic Auth one-time code.
 */
authRoutes.post("/login/magic", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const body = await c.req.parseBody();
  const email = readFormString(body, "email");
  const returnTo = sanitizeReturnTo(readFormString(body, "returnTo"));

  if (!email) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        error: "Email is required for a one-time code.",
      }),
    );
  }

  try {
    const workos = getWorkOS(c.env);
    await workos.userManagement.createMagicAuth({ email });
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "magic",
        email,
        notice: "Check your email for a one-time code.",
      }),
    );
  } catch (err) {
    const parsed = parseWorkOsError(err);
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        email,
        error: parsed.message || "Could not send a code.",
      }),
    );
  }
});

/**
 * POST /login/magic/verify — complete Magic Auth with the emailed code.
 */
authRoutes.post("/login/magic/verify", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const body = await c.req.parseBody();
  const email = readFormString(body, "email");
  const code = readFormString(body, "code");
  const returnTo = sanitizeReturnTo(readFormString(body, "returnTo"));

  if (!email || !code) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "magic",
        email,
        error: "Email and code are required.",
      }),
    );
  }

  const workos = getWorkOS(c.env);
  const attempt = await resolveAuthAttempt(c.env, config, email, () =>
    workos.userManagement.authenticateWithMagicAuth({
      clientId: config.workosClientId,
      email,
      code,
      session: sessionSeal(config),
    }),
  );

  if (!attempt.ok) {
    if (attempt.kind === "verify-email") {
      return c.redirect(redirectAuthFailure(returnTo, email, attempt));
    }
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "magic",
        email,
        error: attempt.message,
      }),
    );
  }

  setSessionCookie(c, attempt.sealedSession);
  return c.redirect(returnTo);
});

/**
 * POST /login/verify-email — complete email verification after password signup/sign-in.
 */
authRoutes.post("/login/verify-email", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const body = await c.req.parseBody();
  const email = readFormString(body, "email");
  const code = readFormString(body, "code");
  const pendingToken = readFormString(body, "pendingToken");
  const returnTo = sanitizeReturnTo(readFormString(body, "returnTo"));

  if (!code || !pendingToken) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "verify-email",
        email,
        pendingToken,
        error: "Verification code is required.",
      }),
    );
  }

  const workos = getWorkOS(c.env);
  const attempt = await resolveAuthAttempt(c.env, config, email, () =>
    workos.userManagement.authenticateWithEmailVerification({
      clientId: config.workosClientId,
      code,
      pendingAuthenticationToken: pendingToken,
      session: sessionSeal(config),
    }),
  );

  if (!attempt.ok) {
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        mode: "verify-email",
        email,
        pendingToken,
        error: attempt.message,
      }),
    );
  }

  setSessionCookie(c, attempt.sealedSession);
  return c.redirect(returnTo);
});

/**
 * GET /auth/initiate — WorkOS dashboard Sign-in endpoint (impersonation).
 * Regular users use /login; keep this for AuthKit-hosted redeem flows.
 */
authRoutes.get("/auth/initiate", (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const returnTo = sanitizeReturnTo(c.req.query("returnTo"));
  const origin = new URL(c.req.url).origin;
  const workos = getWorkOS(c.env);

  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: "authkit",
    clientId: config.workosClientId,
    redirectUri: getRedirectUri(config, origin),
    state: returnTo,
    ...(config.workosOrganizationId
      ? { organizationId: config.workosOrganizationId }
      : {}),
  });

  return c.redirect(authorizationUrl);
});

/**
 * GET /callback — exchange OAuth / AuthKit code for a sealed session cookie.
 */
authRoutes.get("/callback", async (c) => {
  const config = getAppConfig(c.env);
  assertWorkosConfigured(config);

  const code = c.req.query("code");
  if (!code) {
    return c.redirect(
      buildLoginRedirect({ error: "Missing authorization code." }),
    );
  }

  const returnTo = sanitizeReturnTo(c.req.query("state"));

  try {
    const workos = getWorkOS(c.env);
    const attempt = await resolveAuthAttempt(c.env, config, "", () =>
      workos.userManagement.authenticateWithCode({
        clientId: config.workosClientId,
        code,
        session: sessionSeal(config),
      }),
    );

    if (!attempt.ok) {
      return c.redirect(redirectAuthFailure(returnTo, "", attempt));
    }

    setSessionCookie(c, attempt.sealedSession);
    return c.redirect(returnTo);
  } catch (err) {
    console.error("[andy-server] auth callback failed:", err);
    return c.redirect(
      buildLoginRedirect({
        returnTo,
        error: "Sign-in failed. Please try again.",
      }),
    );
  }
});

/**
 * POST /logout — clear session cookie and end WorkOS session.
 */
authRoutes.post("/logout", async (c) => {
  const config = getAppConfig(c.env);
  const url = new URL(c.req.url);
  const sessionData = getCookie(c, SESSION_COOKIE);

  deleteCookie(c, SESSION_COOKIE, { path: "/" });

  if (
    !sessionData ||
    !config.workosApiKey ||
    !config.workosClientId ||
    !config.workosCookiePassword
  ) {
    return c.redirect("/");
  }

  try {
    const workos = getWorkOS(c.env);
    const session = workos.userManagement.loadSealedSession({
      sessionData,
      cookiePassword: config.workosCookiePassword,
    });
    const logoutUrl = await session.getLogoutUrl({
      returnTo: `${url.origin}/`,
    });
    return c.redirect(logoutUrl);
  } catch (err) {
    console.error("[andy-server] logout failed:", err);
    return c.redirect("/");
  }
});
