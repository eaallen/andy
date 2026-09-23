import {
  DEFAULT_SUPPLY_VOLTS,
  ENERGIZE_CURRENT_THRESHOLD,
  ENERGIZE_VOLTAGE_THRESHOLD,
  WIRE_OHMS,
} from "./electrical.js";

/**
 * Builds fixed supply voltages for the nodal solve.
 * Single hot = +volts; split-phase hots alternate +volts / −volts vs return at 0.
 * @param {string[]} hotKeys - Terminal keys for supply hots.
 * @param {string} returnKey - Terminal key for supply return.
 * @param {number} volts - Supply RMS magnitude.
 */
export function buildFixedVoltages(hotKeys, returnKey, volts) {
  /** @type {{ [key: string]: number }} */
  const fixed = {};
  fixed[returnKey] = 0;
  for (let i = 0; i < hotKeys.length; i += 1) {
    const sign = i % 2 === 0 ? 1 : -1;
    fixed[hotKeys[i]] = sign * volts;
  }
  return fixed;
}

/**
 * Stamps resistive branches from wires, switch bridges, and conductive loads.
 * Load ohms must already be stamped on each load (normalizeLabConfig).
 * @param {{
 *   wires: object[],
 *   bridges: Array<{ from: object, to: object }>,
 *   loads: object[],
 *   terminalKey: (terminal: object) => string,
 *   resolveEndpoint: (ref: object) => object|null,
 * }} input - Topology snapshot inputs.
 */
export function buildNetworkBranches(input) {
  const wires = input.wires || [];
  const bridges = input.bridges || [];
  const loads = input.loads || [];
  const terminalKey = input.terminalKey;
  const resolveEndpoint = input.resolveEndpoint;

  /** @type {Array<{ id: string, from: string, to: string, ohms: number, kind: string, loadId?: string, wireIndex?: number }>} */
  const branches = [];

  for (let i = 0; i < wires.length; i += 1) {
    const wire = wires[i];
    if (!wire || !wire.from || !wire.to) {
      continue;
    }
    branches.push({
      id: "wire:" + i,
      from: terminalKey(wire.from),
      to: terminalKey(wire.to),
      ohms: WIRE_OHMS,
      kind: "wire",
      wireIndex: i,
    });
  }

  for (let j = 0; j < bridges.length; j += 1) {
    branches.push({
      id: "bridge:" + j,
      from: terminalKey(bridges[j].from),
      to: terminalKey(bridges[j].to),
      ohms: WIRE_OHMS,
      kind: "bridge",
    });
  }

  for (let L = 0; L < loads.length; L += 1) {
    const load = loads[L];
    const ohms = load.ohms;
    if (ohms == null || !(ohms > 0)) {
      continue;
    }
    const requireHot = resolveEndpoint(load.requireHot);
    const signal = resolveEndpoint(load.signal);
    if (!requireHot || !signal) {
      continue;
    }
    branches.push({
      id: "load:" + load.id,
      from: terminalKey(requireHot),
      to: terminalKey(signal),
      ohms: ohms,
      kind: "load",
      loadId: load.id,
    });
  }

  return branches;
}

/**
 * Returns whether a conductive or probe load counts as energized from solve results.
 * @param {object} load - Simulation load row (ohms already stamped).
 * @param {{ voltages: object, currents: object }} solved - Nodal solve output.
 * @param {string} hotKey - requireHot terminal key.
 * @param {string} sigKey - signal terminal key.
 */
export function loadIsEnergized(load, solved, hotKey, sigKey) {
  const ohms = load.ohms;
  if (ohms != null && ohms > 0) {
    const current = solved.currents["load:" + load.id];
    return typeof current === "number" && Math.abs(current) > ENERGIZE_CURRENT_THRESHOLD;
  }
  const va = solved.voltages[hotKey];
  const vb = solved.voltages[sigKey];
  if (typeof va !== "number" || typeof vb !== "number") {
    return false;
  }
  return Math.abs(va - vb) > ENERGIZE_VOLTAGE_THRESHOLD;
}

/**
 * Builds pathKeys from terminals that carry current or sit off return potential.
 * @param {{ branches: object[], voltages: object, currents: object }} solved - Solve bundle.
 * @param {string} returnKey - Supply return terminal key.
 */
export function pathKeysFromSolve(solved, returnKey) {
  /** @type {{ [key: string]: boolean }} */
  const pathKeys = {};
  const returnV = solved.voltages[returnKey] || 0;
  for (let i = 0; i < solved.branches.length; i += 1) {
    const branch = solved.branches[i];
    const current = solved.currents[branch.id];
    if (typeof current === "number" && Math.abs(current) > ENERGIZE_CURRENT_THRESHOLD) {
      pathKeys[branch.from] = true;
      pathKeys[branch.to] = true;
    }
  }
  const keys = Object.keys(solved.voltages);
  for (let k = 0; k < keys.length; k += 1) {
    const key = keys[k];
    const v = solved.voltages[key];
    if (typeof v === "number" && Math.abs(v - returnV) > ENERGIZE_VOLTAGE_THRESHOLD) {
      pathKeys[key] = true;
    }
  }
  return pathKeys;
}

/**
 * Maps solved branch currents onto the live wire list (by stamped wireIndex).
 * @param {object[]} branches - Network branches (may include wireIndex).
 * @param {{ [branchId: string]: number }} currents - Solved currents.
 * @param {number} wireCount - Length of getWires().
 */
export function wireCurrentsFromBranches(branches, currents, wireCount) {
  /** @type {(number|undefined)[]} */
  const wireCurrents = new Array(wireCount);
  for (let i = 0; i < branches.length; i += 1) {
    const branch = branches[i];
    if (branch.kind !== "wire" || typeof branch.wireIndex !== "number") {
      continue;
    }
    const amps = currents[branch.id];
    if (typeof amps === "number") {
      wireCurrents[branch.wireIndex] = amps;
    }
  }
  return wireCurrents;
}

/**
 * Interprets a nodal solve into the simulate() payload (energize + overlay fields).
 * @param {{
 *   voltages: object,
 *   currents: object,
 *   short: boolean,
 *   branches: object[],
 * }} solved - Solve output plus stamped branches.
 * @param {{
 *   loads: object[],
 *   returnKey: string,
 *   wireCount: number,
 *   terminalKey: (terminal: object) => string,
 *   resolveEndpoint: (ref: object) => object|null,
 *   emptyEnergized: () => { [id: string]: boolean },
 * }} ctx - Load / supply context.
 */
export function interpretSolveResult(solved, ctx) {
  const result = {
    energized: ctx.emptyEnergized(),
    pathKeys: pathKeysFromSolve(solved, ctx.returnKey),
    voltages: solved.voltages,
    currents: solved.currents,
    wireCurrents: wireCurrentsFromBranches(
      solved.branches,
      solved.currents,
      ctx.wireCount
    ),
    loadCurrents: {},
    loadVoltages: {},
    short: solved.short,
  };

  const loads = ctx.loads || [];
  for (let i = 0; i < loads.length; i += 1) {
    const load = loads[i];
    const requireHot = ctx.resolveEndpoint(load.requireHot);
    const signal = ctx.resolveEndpoint(load.signal);
    if (!requireHot || !signal) {
      continue;
    }
    const hotKey = ctx.terminalKey(requireHot);
    const sigKey = ctx.terminalKey(signal);
    const va = solved.voltages[hotKey];
    const vb = solved.voltages[sigKey];
    if (typeof va === "number" && typeof vb === "number") {
      result.loadVoltages[load.id] = va - vb;
    }
    if (load.ohms != null && load.ohms > 0) {
      const current = solved.currents["load:" + load.id];
      if (typeof current === "number") {
        result.loadCurrents[load.id] = current;
      }
    }
    if (loadIsEnergized(load, solved, hotKey, sigKey)) {
      result.energized[load.id] = true;
    }
  }

  return result;
}

/**
 * Resolves supply volts with the library default.
 * @param {number|null|undefined} rawVolts - YAML supply.volts.
 */
export function resolveSupplyVolts(rawVolts) {
  if (rawVolts != null && rawVolts > 0) {
    return rawVolts;
  }
  return DEFAULT_SUPPLY_VOLTS;
}
