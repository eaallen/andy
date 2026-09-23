export const VOSHI_JWKS_URL = "https://api.link.voshi.com/lti13/v1/jwks";
export const VOSHI_ISS = "https://api.link.voshi.com";
export const VOSHI_SESSION_COOKIE = "voshi-session";
export const VOSHI_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const LOCATION_TYPES = [
  "assessment",
  "practice",
  "content",
  "setup",
] as const;

export const USER_GROUPS = [
  "manager",
  "instructor",
  "assistant",
  "mentor",
  "student",
] as const;

export const STAFF_GROUPS = [
  "manager",
  "instructor",
  "assistant",
  "mentor",
] as const;
