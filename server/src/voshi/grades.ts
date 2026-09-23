import type { VoshiSession } from "@/voshi/session.js";
import { VoshiError } from "@/voshi/errors.js";

export type VoshiGradeAttempt = {
  id?: string;
  status: "success" | "failed";
  score: number;
  data?: { error?: string | null };
};

/**
 * Returns whether this session may send a grade to the LMS.
 * A grade URL plus a student group is enough; staff-only launches are not.
 * @param session - Current Voshi session.
 */
export function canSubmitGrade(session: VoshiSession): boolean {
  const groups = session.groups ?? [];
  return (
    groups.includes("student") &&
    Boolean(session.gradeSubmit) &&
    Boolean(session.apiToken)
  );
}

/**
 * Throws unless Voshi reports the attempt reached the LMS gradebook.
 * @param grade - Parsed grade attempt, if any.
 */
export function requireSyncedGrade(
  grade: VoshiGradeAttempt | null | undefined,
): VoshiGradeAttempt {
  if (!grade) {
    throw new VoshiError(
      "Grade did not sync to the LMS.",
      503,
      "voshi_grade_failed",
    );
  }
  if (grade.status === "success") {
    return grade;
  }
  throw new VoshiError(
    grade.data?.error || "Grade did not sync to the LMS.",
    503,
    "voshi_grade_failed",
  );
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
 * Narrows a Voshi grade response body into a typed attempt.
 * @param body - Parsed JSON body.
 */
function parseGradeAttempt(body: unknown): VoshiGradeAttempt {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new VoshiError(
      "Grade did not sync to the LMS.",
      503,
      "voshi_grade_failed",
    );
  }
  const raw = body as Record<string, unknown>;
  if (raw.status !== "success" && raw.status !== "failed") {
    throw new VoshiError(
      "Grade did not sync to the LMS.",
      503,
      "voshi_grade_failed",
    );
  }
  if (typeof raw.score !== "number" || !Number.isFinite(raw.score)) {
    throw new VoshiError(
      "Grade did not sync to the LMS.",
      503,
      "voshi_grade_failed",
    );
  }
  const attempt: VoshiGradeAttempt = {
    status: raw.status,
    score: raw.score,
  };
  if (typeof raw.id === "string") {
    attempt.id = raw.id;
  }
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    const data = raw.data as Record<string, unknown>;
    attempt.data = {
      error:
        typeof data.error === "string" || data.error === null
          ? data.error
          : undefined,
    };
  }
  return attempt;
}

/**
 * POSTs a score to the launch's grade.submit URL using the launch api token.
 * @param options - Submit URL, api token, score fraction, optional comment and fetch.
 */
export async function submitVoshiGrade(options: {
  submitUrl: string;
  apiToken: string;
  score: number;
  comment?: string;
  fetchImpl?: typeof fetch;
}): Promise<VoshiGradeAttempt> {
  if (!options.submitUrl) {
    throw new VoshiError(
      "This launch cannot send a grade.",
      422,
      "grade_unavailable",
    );
  }
  if (!options.apiToken) {
    throw new VoshiError(
      "This launch has no api token to send a grade.",
      503,
      "missing_api_token",
    );
  }

  const score = normalizeGradeScore(options.score);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(options.submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      score,
      ...(options.comment ? { comment: options.comment } : {}),
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (response.status === 422) {
    const message =
      (body && typeof body.message === "string" && body.message) ||
      "Voshi rejected the grade.";
    throw new VoshiError(message, 422, "voshi_grade_rejected");
  }

  if (!response.ok) {
    const message =
      (body && typeof body.message === "string" && body.message) ||
      `Voshi grade request failed (${response.status}).`;
    throw new VoshiError(
      message,
      response.status === 401 ? 401 : 503,
      response.status === 401 ? "voshi_unauthorized" : "voshi_grade_failed",
    );
  }

  return parseGradeAttempt(body);
}
