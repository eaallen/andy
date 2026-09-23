import { SHORT_AMP_CAP, WIRE_OHMS } from "./electrical.js";

/** Tiny ground leakage (siemens) so floating islands stay solvable. */
const GROUND_LEAK_S = 1e-12;

/**
 * Solves Ax = b with Gaussian elimination (partial pivoting). Mutates a copy.
 * @param {number[][]} matrix - Square n×n coefficient matrix.
 * @param {number[]} rhs - Length-n right-hand side.
 */
function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  /** @type {number[][]} */
  const a = [];
  for (let i = 0; i < n; i += 1) {
    a[i] = matrix[i].slice();
    a[i].push(rhs[i]);
  }

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    let best = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const mag = Math.abs(a[row][col]);
      if (mag > best) {
        best = mag;
        pivot = row;
      }
    }
    if (best < 1e-18) {
      continue;
    }
    if (pivot !== col) {
      const tmp = a[col];
      a[col] = a[pivot];
      a[pivot] = tmp;
    }
    const diag = a[col][col];
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / diag;
      for (let j = col; j <= n; j += 1) {
        a[row][j] -= factor * a[col][j];
      }
    }
  }

  /** @type {number[]} */
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = a[i][n];
    for (let j = i + 1; j < n; j += 1) {
      sum -= a[i][j] * x[j];
    }
    const diag = a[i][i];
    x[i] = Math.abs(diag) < 1e-18 ? 0 : sum / diag;
  }
  return x;
}

/**
 * Collects unique node keys from branches and fixed-voltage maps.
 * @param {Array<{ from: string, to: string }>} branches - Network branches.
 * @param {{ [nodeKey: string]: number }} fixedVoltages - Known node voltages.
 */
function collectNodeKeys(branches, fixedVoltages) {
  /** @type {{ [key: string]: boolean }} */
  const seen = {};
  const keys = [];

  /**
   * Adds a node key once.
   * @param {string} key - Terminal key.
   */
  function add(key) {
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    keys.push(key);
  }

  const fixedKeys = Object.keys(fixedVoltages || {});
  for (let i = 0; i < fixedKeys.length; i += 1) {
    add(fixedKeys[i]);
  }
  for (let b = 0; b < branches.length; b += 1) {
    add(branches[b].from);
    add(branches[b].to);
  }
  return keys;
}

/**
 * Fills branch currents from solved (or fixed) node voltages.
 * @param {Array<{ id: string, from: string, to: string, ohms: number }>} branches - Network branches.
 * @param {{ [nodeKey: string]: number }} voltages - Node voltages.
 * @param {{ [branchId: string]: number }} currents - Mutable current map.
 */
function stampBranchCurrents(branches, voltages, currents) {
  for (let b = 0; b < branches.length; b += 1) {
    const branch = branches[b];
    const va = voltages[branch.from];
    const vb = voltages[branch.to];
    const r = branch.ohms > 0 ? branch.ohms : WIRE_OHMS;
    const vA = typeof va === "number" ? va : 0;
    const vB = typeof vb === "number" ? vb : 0;
    currents[branch.id] = (vA - vB) / r;
  }
}

/**
 * Returns whether any branch current exceeds the short-display cap.
 * @param {{ [branchId: string]: number }} currents - Solved branch currents.
 */
function branchCurrentExceedsCap(currents) {
  const ids = Object.keys(currents);
  for (let i = 0; i < ids.length; i += 1) {
    if (Math.abs(currents[ids[i]]) > SHORT_AMP_CAP) {
      return true;
    }
  }
  return false;
}

/**
 * Solves a linear resistive network with nodal analysis.
 * Fixed-voltage nodes (supply hot / return) are stamped as known potentials;
 * wires, bridges, and loads are resistive branches.
 * @param {{
 *   branches: Array<{ id: string, from: string, to: string, ohms: number }>,
 *   fixedVoltages: { [nodeKey: string]: number },
 * }} network - Resistive network description.
 */
export function solveResistiveNetwork(network) {
  const branches = network && Array.isArray(network.branches) ? network.branches : [];
  const fixedVoltages = (network && network.fixedVoltages) || {};
  const nodeKeys = collectNodeKeys(branches, fixedVoltages);

  /** @type {{ [nodeKey: string]: number }} */
  const voltages = {};
  /** @type {{ [branchId: string]: number }} */
  const currents = {};

  if (nodeKeys.length === 0) {
    return { voltages: voltages, currents: currents, short: false };
  }

  /** @type {string[]} */
  const unknown = [];
  /** @type {{ [nodeKey: string]: number }} */
  const unknownIndex = {};
  for (let i = 0; i < nodeKeys.length; i += 1) {
    const key = nodeKeys[i];
    if (Object.prototype.hasOwnProperty.call(fixedVoltages, key)) {
      voltages[key] = fixedVoltages[key];
    } else {
      unknownIndex[key] = unknown.length;
      unknown.push(key);
    }
  }

  const n = unknown.length;
  if (n === 0) {
    stampBranchCurrents(branches, voltages, currents);
    return {
      voltages: voltages,
      currents: currents,
      short: branchCurrentExceedsCap(currents),
    };
  }

  /** @type {number[][]} */
  const G = [];
  /** @type {number[]} */
  const I = new Array(n);
  for (let i = 0; i < n; i += 1) {
    G[i] = new Array(n);
    for (let j = 0; j < n; j += 1) {
      G[i][j] = 0;
    }
    I[i] = 0;
    // Leakage to ground keeps disconnected islands numerically stable.
    G[i][i] += GROUND_LEAK_S;
  }

  for (let b = 0; b < branches.length; b += 1) {
    const branch = branches[b];
    const r = branch.ohms > 0 ? branch.ohms : WIRE_OHMS;
    const g = 1 / r;
    const aKey = branch.from;
    const bKey = branch.to;
    const aFixed = Object.prototype.hasOwnProperty.call(fixedVoltages, aKey);
    const bFixed = Object.prototype.hasOwnProperty.call(fixedVoltages, bKey);
    const ai = aFixed ? -1 : unknownIndex[aKey];
    const bi = bFixed ? -1 : unknownIndex[bKey];
    const vaKnown = aFixed ? fixedVoltages[aKey] : 0;
    const vbKnown = bFixed ? fixedVoltages[bKey] : 0;

    if (ai >= 0) {
      G[ai][ai] += g;
      if (bi >= 0) {
        G[ai][bi] -= g;
      } else {
        I[ai] += g * vbKnown;
      }
    }
    if (bi >= 0) {
      G[bi][bi] += g;
      if (ai >= 0) {
        G[bi][ai] -= g;
      } else {
        I[bi] += g * vaKnown;
      }
    }
  }

  const solved = solveLinearSystem(G, I);
  for (let i = 0; i < n; i += 1) {
    voltages[unknown[i]] = solved[i];
  }

  stampBranchCurrents(branches, voltages, currents);

  return {
    voltages: voltages,
    currents: currents,
    short: branchCurrentExceedsCap(currents),
  };
}
