/* global TERMINAL_ROLES, COMPONENT_TYPES, getTerminalComponentGroup */

/**
 * Builds continuity simulation helpers for the doorbell circuit.
 * @param {() => object[]} getWires - Returns the current wire list.
 * @param {() => object} getComponents - Returns the current component map.
 */
function createCircuitSimulator(getWires, getComponents) {
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
   * Collects switch-bridge edges for currently pressed buttons.
   * @param {string[]} pressedKeys - Button keys that are closed (front/rear/side).
   */
  function buttonBridgeEdges(pressedKeys) {
    const components = getComponents();
    const edges = [];
    const buttons = [
      components.buttonFront,
      components.buttonRear,
      components.buttonSide,
    ];

    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i];
      if (!button || pressedKeys.indexOf(button.buttonKey) === -1) {
        continue;
      }
      const com = findTerminalByRole(button, TERMINAL_ROLES.BTN_COMMON);
      const sig = findTerminalByRole(button, TERMINAL_ROLES.BTN_SIGNAL);
      if (com && sig) {
        edges.push({ from: com, to: sig });
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
   * Simulates the circuit with the given buttons pressed.
   * A chime tone is live when Trans is wired to 24V hot and that signal
   * terminal reaches 24V common through the closed switch path.
   * @param {string[]} pressedKeys - Closed button keys.
   */
  function simulate(pressedKeys) {
    const components = getComponents();
    const transformer = components.transformer;
    const chime = components.chime;

    const result = {
      transPowered: false,
      energized: { front: false, rear: false },
      pathKeys: {},
    };

    if (!transformer || !chime) {
      return result;
    }

    const hot = findTerminalByRole(transformer, TERMINAL_ROLES.HOT_24V);
    const com = findTerminalByRole(transformer, TERMINAL_ROLES.COM_24V);
    const trans = findTerminalByRole(chime, TERMINAL_ROLES.CHIME_TRANS);
    const front = findTerminalByRole(chime, TERMINAL_ROLES.CHIME_FRONT);
    const rear = findTerminalByRole(chime, TERMINAL_ROLES.CHIME_REAR);

    if (!hot || !com || !trans) {
      return result;
    }

    const bridges = buttonBridgeEdges(pressedKeys);
    const adjacency = buildAdjacency(bridges);
    const fromHot = bfs(adjacency, hot);
    const fromCom = bfs(adjacency, com);

    result.transPowered = !!fromHot[terminalKey(trans)];
    result.pathKeys = Object.assign({}, fromHot);

    const signals = [
      { key: "front", terminal: front },
      { key: "rear", terminal: rear },
    ];

    for (let i = 0; i < signals.length; i += 1) {
      const signal = signals[i];
      if (!signal.terminal) {
        continue;
      }
      const signalKey = terminalKey(signal.terminal);
      // Signal must reach common through the pressed button path.
      if (result.transPowered && fromCom[signalKey]) {
        result.energized[signal.key] = true;
        Object.assign(result.pathKeys, fromCom);
      }
    }

    return result;
  }

  /**
   * Returns which chime tones are energized for a single pressed button.
   * @param {string} buttonKey - front, rear, or side.
   */
  function energizeForButton(buttonKey) {
    return simulate([buttonKey]);
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
    const list = [
      components.power,
      components.transformer,
      components.chime,
      components.terminalBlock,
      components.buttonFront,
      components.buttonRear,
      components.buttonSide,
    ];

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
    energizeForButton: energizeForButton,
    areWiredTogether: areWiredTogether,
    findTerminalByRole: findTerminalByRole,
    terminalKey: terminalKey,
    highlightPath: highlightPath,
    COMPONENT_TYPES: COMPONENT_TYPES,
  };
}
