/**
 * Normalized shape for WorkOS User Management auth failures.
 */
export type WorkOsAuthError = {
  code?: string;
  message: string;
  pendingAuthenticationToken?: string;
  email?: string;
  organizations?: Array<{ id: string; name: string }>;
};

/**
 * Pulls auth-relevant fields off a WorkOS SDK / API error.
 * @param err - Unknown thrown value from the WorkOS client.
 */
export function parseWorkOsError(err: unknown): WorkOsAuthError {
  if (!err || typeof err !== "object") {
    return { message: "Authentication failed." };
  }

  const record = err as {
    message?: unknown;
    code?: unknown;
    pendingAuthenticationToken?: unknown;
    rawData?: {
      code?: unknown;
      error?: unknown;
      message?: unknown;
      error_description?: unknown;
      pending_authentication_token?: unknown;
      email?: unknown;
      organizations?: unknown;
    };
  };

  const raw = record.rawData ?? {};
  const code =
    (typeof record.code === "string" && record.code) ||
    (typeof raw.code === "string" && raw.code) ||
    (typeof raw.error === "string" && raw.error) ||
    undefined;

  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof raw.message === "string" && raw.message) ||
    (typeof raw.error_description === "string" && raw.error_description) ||
    "Authentication failed.";

  const pendingAuthenticationToken =
    (typeof record.pendingAuthenticationToken === "string" &&
      record.pendingAuthenticationToken) ||
    (typeof raw.pending_authentication_token === "string" &&
      raw.pending_authentication_token) ||
    undefined;

  const email = typeof raw.email === "string" ? raw.email : undefined;

  const organizations = Array.isArray(raw.organizations)
    ? raw.organizations
        .filter(
          (org): org is { id: string; name: string } =>
            !!org &&
            typeof org === "object" &&
            typeof (org as { id?: unknown }).id === "string" &&
            typeof (org as { name?: unknown }).name === "string",
        )
        .map((org) => ({ id: org.id, name: org.name }))
    : undefined;

  return {
    code,
    message,
    pendingAuthenticationToken,
    email,
    organizations,
  };
}

/**
 * Whether the error means the user must enter an email verification code.
 * @param err - Normalized WorkOS auth error.
 */
export function isEmailVerificationRequired(err: WorkOsAuthError): boolean {
  return err.code === "email_verification_required";
}

/**
 * Whether the error means the user must pick an organization.
 * @param err - Normalized WorkOS auth error.
 */
export function isOrgSelectionRequired(err: WorkOsAuthError): boolean {
  return err.code === "organization_selection_required";
}
