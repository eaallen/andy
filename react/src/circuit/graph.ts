/** Undirected link between two terminal keys. */
export type WireEdge = {
  from: string;
  to: string;
};

/** Undirected neighbor lists: terminalKey → neighbor keys. */
export type Adjacency = Map<string, string[]>;

/**
 * Device-internal terminal pair that conducts only while closed
 * (SPST switch, doorbell press, etc.). Applied during BFS, not as wire edges.
 */
export type ContinuityGate = {
  a: string;
  b: string;
  closed: boolean;
};

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
 * Builds an undirected adjacency map from student wire edges only.
 * @param edges - Terminal-to-terminal wire links.
 */
export function buildAdjacency(edges: WireEdge[]): Adjacency {
  const adj: Adjacency = new Map();
  for (const edge of edges) {
    link(adj, edge.from, edge.to);
  }
  return adj;
}

/**
 * Returns the other side of each closed gate that touches `key`.
 * @param {string} key - Terminal key being visited.
 * @param {ContinuityGate[] | undefined} gates - Device gates (open ones ignored).
 */
function gatedNeighbors(
  key: string,
  gates: ContinuityGate[] | undefined,
): string[] {
  if (!gates || gates.length === 0) return [];
  const next: string[] = [];
  for (const gate of gates) {
    if (!gate.closed) continue;
    if (gate.a === key) next.push(gate.b);
    else if (gate.b === key) next.push(gate.a);
  }
  return next;
}

/**
 * Runs BFS from a start terminal and returns every reachable terminal key.
 * Closed continuity gates act as temporary hops between their terminals.
 * @param adj - Undirected neighbor map from wires.
 * @param start - Terminal key to start from.
 * @param gates - Optional device gates (switch/button closed state).
 */
export function reachableFrom(
  adj: Adjacency,
  start: string,
  gates?: ContinuityGate[],
): Set<string> {
  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [
      ...(adj.get(current) ?? []),
      ...gatedNeighbors(current, gates),
    ];
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
 * @param {Adjacency} adj - Undirected neighbor map from wires.
 * @param {string} a - First terminal key.
 * @param {string} b - Second terminal key.
 * @param {ContinuityGate[]} [gates] - Optional device gates.
 */
export function areConnected(
  adj: Adjacency,
  a: string,
  b: string,
  gates?: ContinuityGate[],
): boolean {
  if (a === b) return true;
  return reachableFrom(adj, a, gates).has(b);
}
