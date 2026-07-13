import {
  TERMINAL_ROLES,
  COMPONENT_TYPES,
  getTerminalComponentGroup,
  findTerminal,
} from "./components.js";

/**
 * Builds continuity simulation helpers from a normalized lab simulation config.
 * @param {() => object[]} getWires - Returns the current wire list.
 * @param {() => object} getComponents - Returns the current component map (config id → group).
 * @param {object|null} simulation - Normalized config.simulation (supply, loads, switches).
 */
export function createCircuitSimulator(getWires, getComponents, simulation) {
  /**
   * Builds a stable key for a terminal.
   * @param {{ node: Konva.Circle, id: string, componentGroup?: Konva.Group }} terminal - Terminal metadata.
   */
  function terminalKey(terminal) {
    const group = getTerminalComponentGroup(terminal);
    return (group && group.componentId ? group.componentId : "unknown") + ":" + terminal.id;
  }

  /**
   * Finds a terminal on a component by role.
   * @param {Konva.Group} component - Component group.
   * @param {string} role - Terminal role from TERMINAL_ROLES.
   */
  function findTerminalByRole(component, role) {
    if (!component || !component.terminals) {
      return null;
    }
    for (let i = 0; i < component.terminals.length; i += 1) {
      if (component.terminals[i].role === role) {
        return component.terminals[i];
      }
    }
    return null;
  }

  /**
   * Resolves a normalized { component, terminal } ref against the live component map.
   * @param {{ component: string, terminal: string }|null|undefined} ref - Endpoint from lab config.
   */
  function resolveEndpoint(ref) {
    if (!ref || !ref.component || !ref.terminal) {
      return null;
    }
    const component = getComponents()[ref.component];
    if (!component) {
      return null;
    }
    return findTerminal(component, ref.terminal);
  }

  /**
   * Builds an undirected adjacency map from wires plus temporary bridges.
   * @param {Array<{ from: object, to: object }>} extraEdges - Extra connections (switches).
   */
  function buildAdjacency(extraEdges) {
    const adj = {};

    /**
     * Ensures a node exists in the adjacency map.
     * @param {string} key - Terminal key.
     */
    function ensure(key) {
      if (!adj[key]) {
        adj[key] = [];
      }
    }

    /**
     * Adds an undirected edge between two terminals.
     * @param {object} a - First terminal.
     * @param {object} b - Second terminal.
     */
    function link(a, b) {
      const ka = terminalKey(a);
      const kb = terminalKey(b);
      ensure(ka);
      ensure(kb);
      adj[ka].push({ key: kb, terminal: b });
      adj[kb].push({ key: ka, terminal: a });
    }

    const wires = getWires();
    for (let i = 0; i < wires.length; i += 1) {
      link(wires[i].from, wires[i].to);
    }

    for (let j = 0; j < extraEdges.length; j += 1) {
      link(extraEdges[j].from, extraEdges[j].to);
    }

    return adj;
  }

  /**
   * Returns default closed-switch bridge edges for momentary / SPST devices.
   * Buttons: COM ↔ SIG. SPST switches: COM ↔ NO.
   * @param {Konva.Group} component - Switch/button component.
   */
  function defaultBridgeEdges(component) {
    const btnCom = findTerminalByRole(component, TERMINAL_ROLES.BTN_COMMON);
    const btnSig = findTerminalByRole(component, TERMINAL_ROLES.BTN_SIGNAL);
    if (btnCom && btnSig) {
      return [{ from: btnCom, to: btnSig }];
    }

    const swCom = findTerminalByRole(component, TERMINAL_ROLES.SWITCH_COM);
    const swNo = findTerminalByRole(component, TERMINAL_ROLES.SWITCH_NO);
    if (swCom && swNo) {
      return [{ from: swCom, to: swNo }];
    }

    const com = findTerminal(component, "com");
    const sig = findTerminal(component, "sig");
    if (com && sig) {
      return [{ from: com, to: sig }];
    }
    const no = findTerminal(component, "no");
    if (com && no) {
      return [{ from: com, to: no }];
    }
    return [];
  }

  /**
   * Returns always-on internal bridges (e.g. GFCI LINE↔LOAD when not tripped).
   * @param {Konva.Group} component - Component that may expose internal paths.
   */
  function internalBridgeEdges(component) {
    if (!component || component.componentType !== COMPONENT_TYPES.GFCI) {
      return [];
    }
    const pairs = [
      ["line-hot", "load-hot"],
      ["line-n", "load-n"],
      ["line-g", "load-g"],
    ];
    const edges = [];
    for (let i = 0; i < pairs.length; i += 1) {
      const from = findTerminal(component, pairs[i][0]);
      const to = findTerminal(component, pairs[i][1]);
      if (from && to) {
        edges.push({ from: from, to: to });
      }
    }
    return edges;
  }

  /**
   * Returns traveler bridges for a 3-way or 4-way switch based on throw position.
   * Open = T1 / straight; closed = T2 / cross.
   * @param {Konva.Group} component - Multi-throw switch component.
   * @param {boolean} closed - Whether the switch is in the secondary throw.
   */
  function multiThrowBridgeEdges(component, closed) {
    const kind = component.switchKind || component.componentType;
    if (kind === "three-way" || component.componentType === COMPONENT_TYPES.THREE_WAY) {
      const com = findTerminal(component, "com");
      const t1 = findTerminal(component, "t1");
      const t2 = findTerminal(component, "t2");
      if (!com) {
        return [];
      }
      const traveler = closed ? t2 : t1;
      return traveler ? [{ from: com, to: traveler }] : [];
    }

    if (kind === "four-way" || component.componentType === COMPONENT_TYPES.FOUR_WAY) {
      const a1 = findTerminal(component, "a1");
      const a2 = findTerminal(component, "a2");
      const b1 = findTerminal(component, "b1");
      const b2 = findTerminal(component, "b2");
      if (!a1 || !a2 || !b1 || !b2) {
        return [];
      }
      if (closed) {
        return [
          { from: a1, to: b2 },
          { from: a2, to: b1 },
        ];
      }
      return [
        { from: a1, to: b1 },
        { from: a2, to: b2 },
      ];
    }

    return [];
  }

  /**
   * Builds bridge edges for one closed switch, using YAML overrides when present.
   * @param {Konva.Group} component - Switch/button component.
   * @param {{ id: string, bridges: Array<[string, string]> }|undefined} override - Optional sim switch row.
   */
  function bridgeEdgesForSwitch(component, override) {
    if (override && override.bridges && override.bridges.length > 0) {
      const edges = [];
      for (let i = 0; i < override.bridges.length; i += 1) {
        const pair = override.bridges[i];
        const from = findTerminal(component, pair[0]);
        const to = findTerminal(component, pair[1]);
        if (from && to) {
          edges.push({ from: from, to: to });
        }
      }
      return edges;
    }
    return defaultBridgeEdges(component);
  }

  /**
   * Maps simulation.switches overrides by component id.
   */
  function switchOverrideById() {
    /** @type {{ [id: string]: { id: string, bridges: Array<[string, string]> } }} */
    const map = {};
    if (!simulation || !Array.isArray(simulation.switches)) {
      return map;
    }
    for (let i = 0; i < simulation.switches.length; i += 1) {
      const entry = simulation.switches[i];
      map[entry.id] = entry;
    }
    return map;
  }

  /**
   * Returns whether a component is a 3-way or 4-way (always bridges one throw).
   * @param {Konva.Group} component - Component group.
   */
  function isMultiThrowSwitch(component) {
    if (!component) {
      return false;
    }
    const kind = component.switchKind;
    return (
      kind === "three-way" ||
      kind === "four-way" ||
      component.componentType === COMPONENT_TYPES.THREE_WAY ||
      component.componentType === COMPONENT_TYPES.FOUR_WAY
    );
  }

  /**
   * Collects switch-bridge edges for currently closed switches (by config component id),
   * plus always-on bridges for multi-throw switches and GFCI LINE↔LOAD.
   * @param {string[]} closedSwitchIds - Component ids that are closed / secondary throw.
   */
  function switchBridgeEdges(closedSwitchIds) {
    const components = getComponents();
    const overrides = switchOverrideById();
    const edges = [];
    const closed = closedSwitchIds || [];
    /** @type {{ [id: string]: boolean }} */
    const closedSet = {};
    for (let c = 0; c < closed.length; c += 1) {
      closedSet[closed[c]] = true;
    }

    const ids = Object.keys(components);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const component = components[id];
      if (!component) {
        continue;
      }

      const internal = internalBridgeEdges(component);
      for (let n = 0; n < internal.length; n += 1) {
        edges.push(internal[n]);
      }

      if (!component.isSwitch) {
        continue;
      }

      const isClosed = !!closedSet[id];
      if (isMultiThrowSwitch(component)) {
        const multi = multiThrowBridgeEdges(component, isClosed);
        for (let m = 0; m < multi.length; m += 1) {
          edges.push(multi[m]);
        }
        continue;
      }

      if (!isClosed) {
        continue;
      }
      const bridges = bridgeEdgesForSwitch(component, overrides[id]);
      for (let j = 0; j < bridges.length; j += 1) {
        edges.push(bridges[j]);
      }
    }

    return edges;
  }

  /**
   * Runs BFS from a start terminal and returns reachable terminal keys.
   * @param {object} adjacency - Adjacency map from buildAdjacency.
   * @param {object} startTerminal - Terminal to start from.
   */
  function bfs(adjacency, startTerminal) {
    const startKey = terminalKey(startTerminal);
    const visited = {};
    const queue = [startKey];
    visited[startKey] = true;

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = adjacency[current] || [];
      for (let i = 0; i < neighbors.length; i += 1) {
        const next = neighbors[i];
        if (visited[next.key]) {
          continue;
        }
        visited[next.key] = true;
        queue.push(next.key);
      }
    }

    return visited;
  }

  /**
   * Builds an empty energized map for all configured loads.
   */
  function emptyEnergized() {
    /** @type {{ [loadId: string]: boolean }} */
    const energized = {};
    if (!simulation || !Array.isArray(simulation.loads)) {
      return energized;
    }
    for (let i = 0; i < simulation.loads.length; i += 1) {
      energized[simulation.loads[i].id] = false;
    }
    return energized;
  }

  /**
   * Simulates the circuit with the given switches closed.
   * A load is live when its requireHot reaches any supply.hot and its signal
   * reaches supply.return (wires + closed-switch bridges).
   * @param {string[]} closedSwitchIds - Closed switch/button component ids.
   */
  function simulate(closedSwitchIds) {
    const result = {
      energized: emptyEnergized(),
      pathKeys: {},
    };

    if (!simulation || !simulation.supply || !Array.isArray(simulation.loads)) {
      return result;
    }

    const hotRefs = Array.isArray(simulation.supply.hot)
      ? simulation.supply.hot
      : simulation.supply.hot
        ? [simulation.supply.hot]
        : [];
    const ret = resolveEndpoint(simulation.supply.return);
    const hotTerminals = [];
    for (let h = 0; h < hotRefs.length; h += 1) {
      const terminal = resolveEndpoint(hotRefs[h]);
      if (terminal) {
        hotTerminals.push(terminal);
      }
    }
    if (hotTerminals.length === 0 || !ret) {
      return result;
    }

    const bridges = switchBridgeEdges(closedSwitchIds);
    const adjacency = buildAdjacency(bridges);
    /** @type {{ [key: string]: boolean }} */
    const fromHot = {};
    for (let i = 0; i < hotTerminals.length; i += 1) {
      Object.assign(fromHot, bfs(adjacency, hotTerminals[i]));
    }
    const fromReturn = bfs(adjacency, ret);

    result.pathKeys = Object.assign({}, fromHot);

    let anyLoadLive = false;
    for (let i = 0; i < simulation.loads.length; i += 1) {
      const load = simulation.loads[i];
      const requireHot = resolveEndpoint(load.requireHot);
      const signal = resolveEndpoint(load.signal);
      if (!requireHot || !signal) {
        continue;
      }
      const hotOk = !!fromHot[terminalKey(requireHot)];
      const signalOk = !!fromReturn[terminalKey(signal)];
      if (hotOk && signalOk) {
        result.energized[load.id] = true;
        anyLoadLive = true;
      }
    }

    if (anyLoadLive) {
      Object.assign(result.pathKeys, fromReturn);
    }

    return result;
  }

  /**
   * Returns energization for a single closed switch/button.
   * @param {string} switchId - Component id of the closed switch.
   */
  function energizeForSwitch(switchId) {
    return simulate([switchId]);
  }

  /**
   * Checks whether two terminals are connected through wires only (no switches).
   * @param {object} a - First terminal.
   * @param {object} b - Second terminal.
   */
  function areWiredTogether(a, b) {
    if (!a || !b) {
      return false;
    }
    const adjacency = buildAdjacency([]);
    const visited = bfs(adjacency, a);
    return !!visited[terminalKey(b)];
  }

  /**
   * Highlights terminals that are on the live path; clears previous highlights.
   * @param {object} pathKeys - Map of terminal keys on the path.
   * @param {boolean} active - Whether highlighting is on.
   */
  function highlightPath(pathKeys, active) {
    const components = getComponents();
    const list = Object.keys(components).map(function (id) {
      return components[id];
    });

    for (let i = 0; i < list.length; i += 1) {
      const component = list[i];
      if (!component || !component.terminals) {
        continue;
      }
      for (let t = 0; t < component.terminals.length; t += 1) {
        const terminal = component.terminals[t];
        const key = terminalKey(terminal);
        if (active && pathKeys[key]) {
          terminal.node.shadowColor("#f59e0b");
          terminal.node.shadowBlur(12);
          terminal.node.shadowEnabled(true);
        } else {
          terminal.node.shadowEnabled(false);
        }
      }
    }
  }

  return {
    simulate: simulate,
    energizeForSwitch: energizeForSwitch,
    areWiredTogether: areWiredTogether,
    findTerminalByRole: findTerminalByRole,
    resolveEndpoint: resolveEndpoint,
    terminalKey: terminalKey,
    highlightPath: highlightPath,
    COMPONENT_TYPES: COMPONENT_TYPES,
  };
}
