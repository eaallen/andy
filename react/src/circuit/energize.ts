import { areConnected, type Adjacency } from "./graph";

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
 */
function reachesHot(
  adj: Adjacency,
  supply: SupplyRefs,
  terminal: string,
): boolean {
  return supply.hot.some((hot) => areConnected(adj, hot, terminal));
}

/**
 * Returns whether a load is energized the way a real two-terminal lamp would
 * light: one terminal reaches supply hot and the other reaches supply return,
 * in either polarity.
 */
export function isLoadEnergized(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
): boolean {
  if (supply.hot.length === 0) return false;

  const aHot = reachesHot(adj, supply, load.requireHot);
  const bHot = reachesHot(adj, supply, load.signal);
  const aRet = areConnected(adj, supply.return, load.requireHot);
  const bRet = areConnected(adj, supply.return, load.signal);

  return (aHot && bRet) || (bHot && aRet);
}

/**
 * Returns whether the load is wired in the labeled polarity:
 * requireHot → supply hot and signal → supply return.
 * Use for grading deductions; visual energize stays polarity-agnostic.
 */
export function isLoadPolarityCorrect(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
): boolean {
  if (supply.hot.length === 0) return false;

  const hotOk = reachesHot(adj, supply, load.requireHot);
  if (!hotOk) return false;

  return areConnected(adj, supply.return, load.signal);
}
