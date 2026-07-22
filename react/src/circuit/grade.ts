import {
  areConnected,
  buildAdjacency,
  type WireEdge,
} from "./graph";

/** Expected wire-path continuity between two terminals. */
export type ContinuityCheck = {
  from: string;
  to: string;
  fail?: string;
};

export type ContinuityGrade = {
  ok: boolean;
  failures: string[];
};

/**
 * Grades wire-only continuity checks (no switch bridges).
 * @param {WireEdge[]} wires - Student wires as terminal key pairs.
 * @param {ContinuityCheck[]} checks - Expected from→to paths.
 */
export function gradeContinuity(
  wires: WireEdge[],
  checks: ContinuityCheck[],
): ContinuityGrade {
  const adj = buildAdjacency(wires);
  const failures: string[] = [];

  for (const check of checks) {
    if (!areConnected(adj, check.from, check.to)) {
      failures.push(
        check.fail ??
          `Expected continuity was not found between ${check.from} and ${check.to}.`,
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}
