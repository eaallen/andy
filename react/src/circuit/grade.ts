import {
  areConnected,
  buildAdjacency,
  type Adjacency,
  type WireEdge,
} from "./graph";
import {
  isLoadPolarityCorrect,
  type LoadRefs,
  type SupplyRefs,
} from "./energize";

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
 * Grades wire-only continuity checks (ignores switch/button gates).
 * @param wires - Student wires as terminal key pairs.
 * @param checks - Expected from→to paths.
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

/**
 * Deducts when a load is wired with reversed hot/neutral polarity.
 * Visual energize may still light; this is a labeling / best-practice check.
 * @param adj - Wire adjacency.
 * @param supply - Supply hot / return terminals.
 * @param load - Load endpoints.
 * @param fail - Failure message when polarity is reversed.
 */
export function gradeLoadPolarity(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
  fail = "Load hot and neutral are reversed.",
): ContinuityGrade {
  if (isLoadPolarityCorrect(adj, supply, load)) {
    return { ok: true, failures: [] };
  }
  return { ok: false, failures: [fail] };
}
