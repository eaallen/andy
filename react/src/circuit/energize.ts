import {
  areConnected,
  type Adjacency,
  type ContinuityGate,
} from "./graph";

/** Supply hot / return terminals for load energization. */
export type SupplyRefs = {
  /** One or more supply hot terminal keys. */
  hot: readonly string[];
  /** Supply return (neutral) terminal key. */
  return: string;
};

/**
 * Load endpoints. Labels are the intended polarity for grading;
 * energization treats them as an unordered pair (either orientation lights).
 */
export type LoadRefs = {
  /** Load terminal labeled as hot (expected to reach a supply hot). */
  requireHot: string;
  /** Load terminal labeled as return/COM (expected to reach supply return). */
  signal: string;
};

/**
 * Returns whether either load terminal reaches any supply hot.
 * @param adj - Wire adjacency.
 * @param supply - Supply hot / return terminals.
 * @param terminal - Load terminal to test.
 * @param gates - Closed switch/button hops.
 */
function reachesHot(
  adj: Adjacency,
  supply: SupplyRefs,
  terminal: string,
  gates?: ContinuityGate[],
): boolean {
  return supply.hot.some((hot) => areConnected(adj, hot, terminal, gates));
}

/**
 * Returns whether a load is energized the way a real two-terminal lamp would
 * light: one terminal reaches supply hot and the other reaches supply return,
 * in either polarity.
 * @param adj - Wire adjacency.
 * @param supply - Supply hot / return terminals.
 * @param load - Load endpoints.
 * @param gates - Closed switch/button hops.
 */
export function isLoadEnergized(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
  gates?: ContinuityGate[],
): boolean {
  if (supply.hot.length === 0) return false;

  const aHot = reachesHot(adj, supply, load.requireHot, gates);
  const bHot = reachesHot(adj, supply, load.signal, gates);
  const aRet = areConnected(adj, supply.return, load.requireHot, gates);
  const bRet = areConnected(adj, supply.return, load.signal, gates);

  return (aHot && bRet) || (bHot && aRet);
}

/**
 * Returns whether the load is wired in the labeled polarity:
 * requireHot → supply hot and signal → supply return.
 * Use for grading deductions; visual energize stays polarity-agnostic.
 * @param adj - Wire adjacency.
 * @param supply - Supply hot / return terminals.
 * @param load - Load endpoints.
 * @param gates - Closed switch/button hops.
 */
export function isLoadPolarityCorrect(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
  gates?: ContinuityGate[],
): boolean {
  if (supply.hot.length === 0) return false;

  const hotOk = reachesHot(adj, supply, load.requireHot, gates);
  if (!hotOk) return false;

  return areConnected(adj, supply.return, load.signal, gates);
}
