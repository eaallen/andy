export const VOSHI_JWKS_URL = "https://api.link.voshi.com/lti13/v1/jwks";
export const VOSHI_API_BASE = "https://api.link.voshi.com/ltiaas/v1";
export const VOSHI_SESSION_COOKIE = "voshi-session";
export const VOSHI_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const LOCATION_TYPES = [
  "assessment",
  "practice",
  "content",
  "setup",
] as const;

export const USER_ROLES = ["student", "instructor", "admin"] as const;
