import { sanitizeReturnTo } from "@/auth/return-to.js";

export type LoginMode = "signin" | "signup" | "magic" | "verify-email";

const LOGIN_MODES = new Set<LoginMode>([
  "signin",
  "signup",
  "magic",
  "verify-email",
]);

/**
 * Parses a login page mode query value.
 * @param raw - Candidate mode from the query string.
 */
export function sanitizeLoginMode(raw: string | undefined | null): LoginMode {
  if (!raw || typeof raw !== "string") {
    return "signin";
  }
  const value = raw.trim().toLowerCase() as LoginMode;
  return LOGIN_MODES.has(value) ? value : "signin";
}

/**
 * Builds a same-origin `/login` redirect with safe query params.
 * @param options - returnTo, optional mode/email/notices, and step tokens.
 */
export function buildLoginRedirect(options: {
  returnTo?: string | null;
  mode?: LoginMode;
  email?: string | null;
  error?: string | null;
  notice?: string | null;
  pendingToken?: string | null;
}): string {
  const url = new URL("/login", "http://andy.local");
  const returnTo = sanitizeReturnTo(options.returnTo);
  url.searchParams.set("returnTo", returnTo);

  const mode = options.mode ?? "signin";
  if (mode !== "signin") {
    url.searchParams.set("mode", mode);
  }

  if (options.email) {
    url.searchParams.set("email", options.email.trim());
  }
  if (options.error) {
    url.searchParams.set("error", options.error);
  }
  if (options.notice) {
    url.searchParams.set("notice", options.notice);
  }
  if (options.pendingToken) {
    url.searchParams.set("pendingToken", options.pendingToken);
  }

  return `${url.pathname}${url.search}`;
}

/**
 * Reads a trimmed non-empty string from form body fields.
 * @param body - Parsed form body.
 * @param key - Field name.
 */
export function readFormString(
  body: Record<string, string | File>,
  key: string,
): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}
