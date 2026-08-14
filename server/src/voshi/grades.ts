import type { VoshiSession } from "@/voshi/session.js";
import { VOSHI_API_BASE } from "@/voshi/constants.js";
import { VoshiError } from "@/voshi/errors.js";

export type VoshiGradeResult = {
  grade_id: string;
  launch_id: string;
  score: number;
  sync_status: "synced" | "failed" | "pending";
  sync_error: string | null;
  submitted_at: string;
  synced_at: string | null;
};

/**
 * Returns whether this session may send a grade to the LMS.
 * @param session - Current Voshi session.
 */
export function canSubmitGrade(session: VoshiSession): boolean {
  return (
    Boolean(session.launchId) &&
    session.role === "student" &&
    session.gradePassback &&
    session.locationType === "assessment"
  );
}

/**
 * Throws unless Voshi reports the score reached the LMS gradebook.
 * HTTP 200 from Voshi is not enough — sync is reported in-band.
 */
export function requireSyncedGrade(
  grade: VoshiGradeResult | null | undefined,
): VoshiGradeResult {
  if (!grade) {
    throw new VoshiError(
      "Grade did not sync to the LMS.",
      503,
      "voshi_grade_failed",
    );
  }

  switch (grade.sync_status) {
    case "synced":
      return grade;
    case "failed":
      throw new VoshiError(
        grade.sync_error || "Grade did not sync to the LMS.",
        503,
        "voshi_grade_failed",
      );
    case "pending":
      throw new VoshiError(
        "Grade is still syncing to the LMS.",
        503,
        "voshi_grade_failed",
      );
    default: {
      const _exhaustive: never = grade.sync_status;
      throw new VoshiError(
        `Grade did not sync to the LMS (${String(_exhaustive)}).`,
        503,
        "voshi_grade_failed",
      );
    }
  }
}

/**
 * Clamps and validates a score fraction for Voshi (0.0–1.0).
 * @param score - Requested score.
 */
export function normalizeGradeScore(score: unknown): number {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new VoshiError("score must be a number between 0 and 1.", 422, "invalid_score");
  }
  if (score < 0 || score > 1) {
    throw new VoshiError("score must be a number between 0 and 1.", 422, "invalid_score");
  }
  return score;
}

/**
 * POSTs a grade to Voshi. Auth is the app API key, not the launch api.token.
 * @param options - API key, launch id, score fraction, optional comment and fetch.
 */
export async function submitVoshiGrade(options: {
  apiKey: string;
  launchId: string;
  score: number;
  comment?: string;
  fetchImpl?: typeof fetch;
}): Promise<VoshiGradeResult> {
  if (!options.apiKey) {
    throw new VoshiError(
      "VOSHI_API_KEY is required to send grades.",
      503,
      "missing_voshi_api_key",
    );
  }

  const score = normalizeGradeScore(options.score);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${VOSHI_API_BASE}/grades`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      launch_id: options.launchId,
      score,
      ...(options.comment ? { comment: options.comment } : {}),
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | VoshiGradeResult
    | { message?: string; error?: string }
    | null;

  if (response.status === 422) {
    const message =
      (body && "message" in body && body.message) ||
      "Voshi rejected the grade.";
    throw new VoshiError(message, 422, "voshi_grade_rejected");
  }

  if (response.status === 404) {
    throw new VoshiError(
      "Unknown launch_id.",
      404,
      "unknown_launch",
    );
  }

  if (!response.ok) {
    const message =
      (body && "message" in body && body.message) ||
      `Voshi grade request failed (${response.status}).`;
    throw new VoshiError(
      message,
      response.status === 401 ? 401 : 503,
      response.status === 401 ? "voshi_unauthorized" : "voshi_grade_failed",
    );
  }

  return body as VoshiGradeResult;
}
