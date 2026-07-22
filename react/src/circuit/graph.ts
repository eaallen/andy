/** Undirected link between two terminal keys. */
export type WireEdge = {
  from: string;
  to: string;
};

/** Undirected neighbor lists: terminalKey → neighbor keys. */
export type Adjacency = Map<string, string[]>;

/**
 * When a component id is closed, these terminal pairs conduct.
 */
export type ComponentBridges = Record<string, WireEdge[]>;

/**
 * Ensures a node exists in the adjacency map.
 * @param {Adjacency} adj - Neighbor map being built.
 * @param {string} key - Terminal key.
 */
function ensure(adj: Adjacency, key: string) {
  if (!adj.has(key)) {
    adj.set(key, []);
  }
}

/**
 * Adds an undirected edge between two terminal keys.
 * @param {Adjacency} adj - Neighbor map being built.
 * @param {string} a - First terminal key.
 * @param {string} b - Second terminal key.
 */
function link(adj: Adjacency, a: string, b: string) {
  if (a === b) return;
  ensure(adj, a);
  ensure(adj, b);
  adj.get(a)!.push(b);
  adj.get(b)!.push(a);
}

/**
 * Builds an undirected adjacency map from wire and bridge edges.
 * @param {WireEdge[]} edges - Terminal-to-terminal links (wires and bridges).
 */
export function buildAdjacency(edges: WireEdge[]): Adjacency {
  const adj: Adjacency = new Map();
  for (const edge of edges) {
    link(adj, edge.from, edge.to);
  }
  return adj;
}

/**
 * Collects internal bridge edges for currently closed components.
 * @param {string[]} closedIds - Component ids that are pressed / closed.
 * @param {ComponentBridges} bridgesByComponent - Per-component bridge pairs.
 */
export function bridgeEdgesForClosed(
  closedIds: string[],
  bridgesByComponent: ComponentBridges,
): WireEdge[] {
  const edges: WireEdge[] = [];
  for (const id of closedIds) {
    const bridges = bridgesByComponent[id];
    if (!bridges) continue;
    for (const edge of bridges) {
      edges.push(edge);
    }
  }
  return edges;
}

/**
 * Runs BFS from a start terminal and returns every reachable terminal key.
 * @param adj - Undirected neighbor map.
 * @param start - Terminal key to start from.
 */
export function reachableFrom(adj: Adjacency, start: string): Set<string> {
  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) ?? [];
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return visited;
}

/**
 * Returns whether two terminals are in the same connected component.
 * @param {Adjacency} adj - Undirected neighbor map.
 * @param {string} a - First terminal key.
 * @param {string} b - Second terminal key.
 */
export function areConnected(adj: Adjacency, a: string, b: string): boolean {
  if (a === b) return true;
  return reachableFrom(adj, a).has(b);
}
