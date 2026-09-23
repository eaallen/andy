import { voshiLocationsCatalog } from "@/lab/graded-labs.js";

/**
 * Sanitizes a location extid into a lab catalog id.
 * @param raw - Candidate lab id from `location.extid`.
 */
export function sanitizeLabId(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const id = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    console.error("Invalid lab id:", id);
    return null;
  }
  return id;
}

/**
 * Builds the in-app path for a Voshi location extid.
 * A known-shaped id opens that lab. Anything else opens the picker.
 * @param extid - `location.extid` from the launch JWT.
 */
export function labPathFromExtid(extid: string | undefined | null): string {
  const labId = sanitizeLabId(extid);
  if (!labId) {
    return "/lab";
  }
  return `/lab?lab=${encodeURIComponent(labId)}`;
}

/** Assessment locations Andy offers instructors, keyed by extid. */
export const gradedLabLocations = voshiLocationsCatalog();
