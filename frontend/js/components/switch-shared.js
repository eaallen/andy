import Konva from "konva";

/** Toggle button chrome inset from the shell. */
const BTN_X = 10;
const BTN_Y = 26;
const BTN_H = 48;

/** Internal throw indicator — light sky blue, distinct from wire blue (#2563eb). */
const BRIDGE_STROKE = "#7dd3fc";

/**
 * Draws a blue-tinted shell used for toggle switches.
 * Matches the React lab Module / Switch shell palette.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
export function addSwitchShell(group, width, height, title) {
  const rect = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: "#f0f9ff",
    stroke: "#7dd3fc",
    strokeWidth: 2,
    cornerRadius: 8,
    shadowColor: "rgba(37, 99, 235, 0.12)",
    shadowBlur: 10,
    shadowOffsetY: 2,
    name: "component-shell",
  });

  const titleText = new Konva.Text({
    x: 10,
    y: 8,
    text: title,
    fontSize: 13,
    fontFamily: "system-ui, Arial, sans-serif",
    fontStyle: "bold",
    fill: "#1e40af",
    listening: false,
    name: "component-title",
  });

  group.add(rect);
  group.add(titleText);

  return { width: width, height: height };
}

/**
 * Adds bridge wire segments updated by applySwitchVisual.
 * Drawn above the shell fill but under the title (and under the button).
 * @param {Konva.Group} group - Parent component group.
 * @param {number} [segmentCount=1] - Number of bridge segments (2 for four-way).
 */
export function addSwitchBridges(group, segmentCount) {
  const count = segmentCount || 1;
  const bridges = [];
  for (let i = 0; i < count; i += 1) {
    const line = new Konva.Line({
      points: [0, 0, 0, 0],
      stroke: BRIDGE_STROKE,
      strokeWidth: 3,
      lineCap: "round",
      listening: false,
      visible: false,
      name: "switch-bridge",
    });
    group.add(line);
    bridges.push(line);
  }
  group.switchBridges = bridges;

  // Keep the label readable when vertical bridges cross the title area (4-way).
  const title = group.findOne(".component-title");
  if (title) {
    title.moveToTop();
  }

  return bridges;
}

/**
 * Adds raised toggle-button chrome and hint label (the click target).
 * Keeps `group.switchHit` for app.js bindToggleSwitch.
 * @param {Konva.Group} group - Switch component group.
 * @param {number} shellWidth - Shell width.
 * @param {string} hintText - Initial hint text.
 */
export function addSwitchButton(group, shellWidth, hintText) {
  const btnW = shellWidth - BTN_X * 2;
  const btn = new Konva.Rect({
    x: BTN_X,
    y: BTN_Y,
    width: btnW,
    height: BTN_H,
    fill: "#ffffff",
    stroke: "#93c5fd",
    strokeWidth: 2,
    cornerRadius: 8,
    name: "switch-hit",
  });
  group.add(btn);
  group.switchHit = btn;
  group.switchButton = btn;

  group.add(
    new Konva.Text({
      x: BTN_X,
      y: BTN_Y + BTN_H - 16,
      width: btnW,
      align: "center",
      text: hintText,
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#2563eb",
      listening: false,
      name: "switch-hint",
    })
  );
}

/**
 * Draws an SPST contact / actuator symbol centered on the toggle button.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} shellWidth - Shell width (symbol is centered horizontally).
 */
export function addSpstToggleSymbol(group, shellWidth) {
  const cx = shellWidth / 2;
  const cy = BTN_Y + 14;
  const half = 18;
  const contactY = cy + 6;
  const hingeX = cx - half + 10;
  const openEndX = cx + half - 4;
  const openEndY = contactY - 10;
  const closedEndX = cx + half - 10;
  const closedEndY = contactY;

  group.add(
    new Konva.Line({
      points: [cx - half, contactY, hingeX, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [closedEndX, contactY, cx + half, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );

  const actuator = new Konva.Line({
    points: [hingeX, contactY, openEndX, openEndY],
    stroke: "#18181b",
    strokeWidth: 2,
    lineCap: "round",
    listening: false,
    name: "switch-actuator",
  });
  group.add(actuator);

  group.switchSymbol = {
    kind: "spst",
    actuator: actuator,
    hingeX: hingeX,
    contactY: contactY,
    openEndX: openEndX,
    openEndY: openEndY,
    closedEndX: closedEndX,
    closedEndY: closedEndY,
  };
  return actuator;
}

/**
 * Draws an SPDT three-way symbol (COM hinge swinging between T1 and T2).
 * @param {Konva.Group} group - Parent component group.
 * @param {number} shellWidth - Shell width (symbol is centered horizontally).
 */
export function addThreeWayToggleSymbol(group, shellWidth) {
  const cx = shellWidth / 2;
  const contactY = BTN_Y + 20;
  const half = 22;
  const hingeX = cx;
  const t1EndX = cx - half + 4;
  const t2EndX = cx + half - 4;
  const throwEndY = contactY;

  group.add(
    new Konva.Line({
      points: [t1EndX - 4, throwEndY, t1EndX + 4, throwEndY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [t2EndX - 4, throwEndY, t2EndX + 4, throwEndY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [hingeX, contactY - 10, hingeX, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );

  const actuator = new Konva.Line({
    points: [hingeX, contactY, t1EndX, throwEndY],
    stroke: "#2563eb",
    strokeWidth: 2,
    lineCap: "round",
    listening: false,
    name: "switch-actuator",
  });
  group.add(actuator);

  group.switchSymbol = {
    kind: "three-way",
    actuator: actuator,
    hingeX: hingeX,
    contactY: contactY,
    openEndX: t1EndX,
    openEndY: throwEndY,
    closedEndX: t2EndX,
    closedEndY: throwEndY,
  };
  return actuator;
}

/**
 * Local center of a terminal handle inside its component group.
 * @param {{ handle?: Konva.Group, node?: Konva.Circle }} terminal - Terminal metadata.
 */
function terminalLocalPos(terminal) {
  if (terminal.handle) {
    return { x: terminal.handle.x(), y: terminal.handle.y() };
  }
  if (terminal.node) {
    return { x: terminal.node.x(), y: terminal.node.y() };
  }
  return { x: 0, y: 0 };
}

/**
 * Finds a terminal on a switch by its local id.
 * @param {Konva.Group} sw - Switch component group.
 * @param {string} id - Terminal id (e.g. "com", "no").
 */
function findTerminal(sw, id) {
  const terminals = sw.terminals || [];
  for (let i = 0; i < terminals.length; i += 1) {
    if (terminals[i].id === id) {
      return terminals[i];
    }
  }
  return null;
}

/**
 * Returns terminal-id pairs that should show a bridge for this switch state.
 * @param {string} kind - "spst" | "three-way" | "four-way".
 * @param {boolean} closed - Throw / closed state.
 */
export function switchBridgePairs(kind, closed) {
  if (kind === "three-way") {
    return [["com", closed ? "t2" : "t1"]];
  }
  if (kind === "four-way") {
    return closed
      ? [
          ["a1", "b2"],
          ["a2", "b1"],
        ]
      : [
          ["a1", "b1"],
          ["a2", "b2"],
        ];
  }
  // SPST: bridge only while closed.
  return closed ? [["com", "no"]] : [];
}

/**
 * Sets one bridge segment between two terminals (or hides it).
 * @param {Konva.Line|undefined} bridge - Bridge line node.
 * @param {object|null} from - From terminal.
 * @param {object|null} to - To terminal.
 * @param {boolean} visible - Whether the bridge should show.
 */
function setBridgeSegment(bridge, from, to, visible) {
  if (!bridge) {
    return;
  }
  if (!visible || !from || !to) {
    bridge.visible(false);
    return;
  }
  const a = terminalLocalPos(from);
  const b = terminalLocalPos(to);
  bridge.points([a.x, a.y, b.x, b.y]);
  bridge.visible(true);
}

/**
 * Refreshes bridge wire geometry from current terminal positions and throw state.
 * @param {Konva.Group} sw - Switch component group.
 */
export function refreshSwitchBridges(sw) {
  const bridges = sw.switchBridges;
  if (!bridges || !bridges.length) {
    return;
  }
  const pairs = switchBridgePairs(sw.switchKind || "spst", !!sw.isClosed);
  for (let i = 0; i < bridges.length; i += 1) {
    const pair = pairs[i];
    if (!pair) {
      setBridgeSegment(bridges[i], null, null, false);
      continue;
    }
    setBridgeSegment(
      bridges[i],
      findTerminal(sw, pair[0]),
      findTerminal(sw, pair[1]),
      true
    );
  }
}

/**
 * Keeps bridge wires aligned when a terminal slides along its edge.
 * @param {Konva.Group} sw - Switch component group (terminals already attached).
 */
export function bindSwitchBridgeRefresh(sw) {
  const terminals = sw.terminals || [];
  for (let i = 0; i < terminals.length; i += 1) {
    const handle = terminals[i].handle;
    if (!handle) {
      continue;
    }
    handle.on("terminalslide", function () {
      refreshSwitchBridges(sw);
    });
  }
}

/**
 * Updates a toggle switch symbol, button chrome, bridges, and shell for state.
 * SPST: Open / Closed. Three-way: T1 / T2. Four-way: Straight / Cross.
 * @param {Konva.Group} sw - Switch component from a switch factory.
 * @param {{ closed?: boolean }} state - Visual state flags.
 */
export function applySwitchVisual(sw, state) {
  const closed = !!state.closed;
  sw.isClosed = closed;
  sw.isPressed = closed;
  const shell = sw.findOne(".component-shell");
  const button = sw.switchButton || sw.switchHit;
  const symbol = sw.switchSymbol;
  const hint = sw.findOne(".switch-hint");
  const kind = sw.switchKind || "spst";

  if (shell) {
    shell.fill(closed ? "#dbeafe" : "#f0f9ff");
    shell.stroke(closed ? "#2563eb" : "#7dd3fc");
  }

  if (button && button.fill) {
    button.fill(closed ? "#bfdbfe" : "#ffffff");
    button.stroke(closed ? "#2563eb" : "#93c5fd");
  }

  if (symbol && symbol.actuator) {
    if (closed) {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.closedEndX,
        symbol.closedEndY,
      ]);
    } else {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.openEndX,
        symbol.openEndY,
      ]);
    }
    // Three-way actuator stays blue in both throws; SPST only when closed.
    if (symbol.kind === "three-way") {
      symbol.actuator.stroke("#2563eb");
    } else {
      symbol.actuator.stroke(closed ? "#2563eb" : "#18181b");
    }
  }

  if (hint) {
    if (kind === "three-way") {
      hint.text(closed ? "T2" : "T1");
    } else if (kind === "four-way") {
      hint.text(closed ? "Cross" : "Straight");
    } else {
      hint.text(closed ? "Closed" : "Open");
    }
    hint.fill(closed ? "#1d4ed8" : "#2563eb");
  }

  refreshSwitchBridges(sw);
}
