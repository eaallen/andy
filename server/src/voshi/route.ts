/**
 * Sanitizes a location.params.lab value into a lab catalog id.
 * @param raw - Candidate lab id (Voshi params are always strings).
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
 * Builds the in-app path for a Voshi location.
 * Instructors set `lab` on the location (e.g. `doorbell`) so the assignment
 * opens that exercise. Home / missing param opens the lab picker.
 * @param params - Location params from the launch JWT.
 */
export function labPathFromParams(params: Record<string, string>): string {
  const labId = sanitizeLabId(params.lab);
  if (!labId) {
    return "/lab";
  }
  return `/lab?lab=${encodeURIComponent(labId)}`;
}
