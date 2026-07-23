const DEFAULT_RETURN_TO = "/author";

/**
 * Sanitizes a post-login return path to same-origin relative paths only.
 * Rejects protocol-relative URLs, absolute URLs, and non-path values.
 * @param raw - Candidate returnTo from query or OAuth state.
 */
export function sanitizeReturnTo(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_RETURN_TO;
  }
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }
  if (value.includes("://") || value.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

export { DEFAULT_RETURN_TO };
