import { areConnected, type Adjacency } from "./graph";

/** Supply hot / return terminals for load energization. */
export type SupplyRefs = {
  /** One or more supply hot terminal keys. */
  hot: readonly string[];
  /** Supply return (neutral) terminal key. */
  return: string;
};

/** Load endpoints that must reach supply hot and return. */
export type LoadRefs = {
  /** Load terminal that must reach a supply hot. */
  requireHot: string;
  /** Load terminal that must reach supply return. */
  signal: string;
};

/**
 * Returns whether a load is energized: requireHot reaches any supply hot
 * and signal reaches supply return (undirected continuity).
 */
export function isLoadEnergized(
  adj: Adjacency,
  supply: SupplyRefs,
  load: LoadRefs,
): boolean {
  if (supply.hot.length === 0) return false;

  const hotOk = supply.hot.some((hot) =>
    areConnected(adj, hot, load.requireHot),
  );
  if (!hotOk) return false;

  return areConnected(adj, supply.return, load.signal);
}
