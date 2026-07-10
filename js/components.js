/* global Konva */

/**
 * Component type identifiers used across the doorbell lab.
 */
const COMPONENT_TYPES = {
  POWER: "power",
  TRANSFORMER: "transformer",
  CHIME: "chime",
  BUTTON: "button",
  TERMINAL_BLOCK: "terminalBlock",
};

/**
 * Terminal role identifiers for continuity tracing and grading.
 */
const TERMINAL_ROLES = {
  L1: "l1",
  NEUTRAL: "neutral",
  GROUND: "ground",
  HOT_24V: "hot24v",
  COM_24V: "com24v",
  CHIME_FRONT: "chimeFront",
  CHIME_TRANS: "chimeTrans",
  CHIME_REAR: "chimeRear",
  BTN_COMMON: "btnCommon",
  BTN_SIGNAL: "btnSignal",
  JUNCTION: "junction",
};

const WIRE_COLORS = {
  red: "#dc2626",
  black: "#18181b",
  blue: "#2563eb",
  green: "#16a34a",
  gray: "#71717a",
};

// Global, used to keep track of the next component id to be assigned.
let nextComponentId = 0;

/**
 * Allocates a unique id string for a component instance.
 * @param {string} prefix - Short type prefix (e.g. "power", "btn-front").
 */
function nextComponentInstanceId(prefix) {
  nextComponentId += 1;
  return prefix + "-" + nextComponentId;
}

/**
 * Returns absolute stage coordinates for a terminal circle center.
 * @param {{ node: Konva.Circle }} terminal - Terminal metadata object.
 */
function getTerminalPosition(terminal) {
  return terminal.node.getAbsolutePosition();
}

/**
 * Attaches shared component metadata to a Konva group.
 * @param {Konva.Group} group - Component group.
 * @param {string} componentType - One of COMPONENT_TYPES.
 * @param {string} instanceId - Unique instance id.
 * @param {Array<object>} terminals - Terminal metadata objects.
 */
function initComponent(group, componentType, instanceId, terminals) {
  group.componentType = componentType;
  group.componentId = instanceId;
  group.terminals = terminals;
  group.draggable(true);
}

/**
 * Draws a labeled terminal circle on a component group.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} x - Local x of the terminal center.
 * @param {number} y - Local y of the terminal center.
 * @param {string} id - Terminal id within the component.
 * @param {string} label - Short label shown beside the terminal.
 * @param {{ role?: string, wireColor?: string, radius?: number }} [opts] - Terminal options.
 */
function addTerminal(group, x, y, id, label, opts) {
  const options = opts || {};
  const radius = options.radius || 7;
  const fill = WIRE_COLORS[options.wireColor] || WIRE_COLORS.gray;

  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: radius,
    fill: fill,
    stroke: "#ffffff",
    strokeWidth: 2,
    hitStrokeWidth: 16,
    name: "terminal",
  });

  const text = new Konva.Text({
    x: x + radius + 4,
    y: y - 6,
    text: label,
    fontSize: 11,
    fontFamily: "system-ui, Arial, sans-serif",
    fill: "#3f3f46",
    listening: false,
  });

  group.add(circle);
  group.add(text);

  return {
    id: id,
    label: label,
    role: options.role || TERMINAL_ROLES.JUNCTION,
    wireColor: options.wireColor || "gray",
    node: circle,
    getPosition: function () {
      return getTerminalPosition(this);
    },
  };
}

/**
 * Draws a white component box with title and subtle shadow.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
function addComponentShell(group, width, height, title) {
  const rect = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: "#ffffff",
    stroke: "#a1a1aa",
    strokeWidth: 1.5,
    cornerRadius: 8,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowBlur: 8,
    shadowOffsetY: 2,
    listening: false,
  });

  const titleText = new Konva.Text({
    x: 10,
    y: 8,
    text: title,
    fontSize: 13,
    fontFamily: "system-ui, Arial, sans-serif",
    fontStyle: "bold",
    fill: "#18181b",
    listening: false,
  });

  group.add(rect);
  group.add(titleText);

  return { width: width, height: height };
}

/**
 * Draws a simple SPST switch symbol (open contacts with actuator).
 * @param {Konva.Group} group - Parent group.
 * @param {number} x - Local x of symbol center.
 * @param {number} y - Local y of symbol center.
 * @param {number} width - Symbol width.
 */
function addSwitchSymbol(group, x, y, width) {
  const half = width / 2;
  const contactY = y + 6;

  group.add(
    new Konva.Line({
      points: [x - half, contactY, x - half + 10, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [x + half - 10, contactY, x + half, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [x - half + 10, contactY, x + half - 4, contactY - 10],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
}

/**
 * Draws a ground symbol (three descending horizontal lines).
 * @param {Konva.Group} group - Parent group.
 * @param {number} x - Local x of symbol center.
 * @param {number} y - Local y of the top line.
 */
function addGroundSymbol(group, x, y) {
  const widths = [16, 11, 6];
  for (let i = 0; i < widths.length; i += 1) {
    const lineWidth = widths[i];
    group.add(
      new Konva.Line({
        points: [x - lineWidth / 2, y + i * 4, x + lineWidth / 2, y + i * 4],
        stroke: WIRE_COLORS.green,
        strokeWidth: 2,
        lineCap: "round",
        listening: false,
      })
    );
  }
}

/**
 * Creates a 120 V power source with L1, N, and G terminals (bottom-left layout).
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makePower(x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const shell = addComponentShell(group, 110, 88, "Power");

  addSwitchSymbol(group, shell.width / 2, 42, 36);

  group.add(
    new Konva.Text({
      x: 12,
      y: 62,
      text: "120V",
      fontSize: 11,
      fontFamily: "system-ui, Arial, sans-serif",
      fill: "#71717a",
      listening: false,
    })
  );

  const terminalY = 6;
  const spacing = shell.width / 4;
  const terminals = [
    addTerminal(group, spacing, terminalY, "l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
    }),
    addTerminal(group, spacing * 2, terminalY, "n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "black",
    }),
    addTerminal(group, spacing * 3, terminalY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
    }),
  ];

  initComponent(group, COMPONENT_TYPES.POWER, nextComponentInstanceId("power"), terminals);
  return group;
}

/**
 * Creates a terminal block with 120 V and low-voltage junction dots (center layout).
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeTerminalBlock(x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const shell = addComponentShell(group, 280, 78, "Terminal Block");

  const topY = 38;
  const bottomY = 58;
  const topSpacing = shell.width / 4;
  const bottomSpacing = shell.width / 5;

  const terminals = [
    addTerminal(group, topSpacing, topY, "l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
    }),
    addTerminal(group, topSpacing * 2, topY, "n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "black",
    }),
    addTerminal(group, topSpacing * 3, topY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
    }),
    addTerminal(group, bottomSpacing, bottomY, "com", "COM", {
      role: TERMINAL_ROLES.COM_24V,
      wireColor: "black",
    }),
    addTerminal(group, bottomSpacing * 2, bottomY, "sig-f", "F", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
    }),
    addTerminal(group, bottomSpacing * 3, bottomY, "sig-r", "R", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
    }),
    addTerminal(group, bottomSpacing * 4, bottomY, "sig-s", "S", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
    }),
  ];

  group.add(
    new Konva.Line({
      points: [16, 48, shell.width - 16, 48],
      stroke: "#e4e4e7",
      strokeWidth: 1,
      listening: false,
    })
  );

  initComponent(
    group,
    COMPONENT_TYPES.TERMINAL_BLOCK,
    nextComponentInstanceId("terminal-block"),
    terminals
  );
  return group;
}

/**
 * Creates a 120 V to 24 V transformer with primary and secondary terminals (top-right layout).
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeTransformer(x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const shell = addComponentShell(group, 150, 110, "Transformer");

  group.add(
    new Konva.Line({
      points: [16, 55, shell.width - 16, 55],
      stroke: "#e4e4e7",
      strokeWidth: 1,
      dash: [4, 4],
      listening: false,
    })
  );

  group.add(
    new Konva.Text({
      x: 14,
      y: 62,
      text: "120V",
      fontSize: 11,
      fontFamily: "system-ui, Arial, sans-serif",
      fill: "#71717a",
      listening: false,
    })
  );

  group.add(
    new Konva.Text({
      x: 100,
      y: 28,
      text: "24V",
      fontSize: 11,
      fontFamily: "system-ui, Arial, sans-serif",
      fill: "#71717a",
      listening: false,
    })
  );

  addGroundSymbol(group, 28, 78);

  const terminals = [
    addTerminal(group, 104, 8, "sec-hot", "24V", {
      role: TERMINAL_ROLES.HOT_24V,
      wireColor: "red",
    }),
    addTerminal(group, 130, 8, "sec-com", "COM", {
      role: TERMINAL_ROLES.COM_24V,
      wireColor: "black",
    }),
    addTerminal(group, 24, shell.height - 8, "pri-l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
    }),
    addTerminal(group, 50, shell.height - 8, "pri-n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "black",
    }),
    addTerminal(group, 28, 70, "pri-g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      radius: 6,
    }),
  ];

  initComponent(
    group,
    COMPONENT_TYPES.TRANSFORMER,
    nextComponentInstanceId("transformer"),
    terminals
  );
  return group;
}

/**
 * Creates a chime with Front, Trans, and Rear terminals (top-left layout).
 * Rear is shared by the Rear and Side doorbell buttons.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeChime(x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const shell = addComponentShell(group, 170, 82, "Chime");

  group.add(
    new Konva.Rect({
      x: 18,
      y: 34,
      width: shell.width - 36,
      height: 20,
      fill: "#f4f4f5",
      stroke: "#d4d4d8",
      strokeWidth: 1,
      cornerRadius: 4,
      listening: false,
    })
  );

  group.add(
    new Konva.Text({
      x: 28,
      y: 39,
      text: "Front   Trans   Rear",
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fill: "#71717a",
      listening: false,
    })
  );

  const terminalY = shell.height - 6;
  const spacing = shell.width / 4;
  const terminals = [
    addTerminal(group, spacing, terminalY, "front", "Front", {
      role: TERMINAL_ROLES.CHIME_FRONT,
      wireColor: "red",
    }),
    addTerminal(group, spacing * 2, terminalY, "trans", "Trans", {
      role: TERMINAL_ROLES.CHIME_TRANS,
      wireColor: "red",
    }),
    addTerminal(group, spacing * 3, terminalY, "rear", "Rear", {
      role: TERMINAL_ROLES.CHIME_REAR,
      wireColor: "red",
    }),
  ];

  initComponent(group, COMPONENT_TYPES.CHIME, nextComponentInstanceId("chime"), terminals);
  return group;
}

/**
 * Creates a momentary doorbell button with common and signal terminals.
 * @param {"Front" | "Rear" | "Side"} label - Button label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeButton(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const shell = addComponentShell(group, 96, 78, label);

  addSwitchSymbol(group, shell.width / 2, 42, 30);

  const terminalY = 8;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const terminals = [
    addTerminal(group, leftX, terminalY, "com", "COM", {
      role: TERMINAL_ROLES.BTN_COMMON,
      wireColor: "black",
    }),
    addTerminal(group, rightX, terminalY, "sig", "SIG", {
      role: TERMINAL_ROLES.BTN_SIGNAL,
      wireColor: "red",
    }),
  ];

  const buttonKey = label.toLowerCase();
  group.buttonKey = buttonKey;
  group.isSwitch = true;
  group.isPressed = false;

  initComponent(
    group,
    COMPONENT_TYPES.BUTTON,
    nextComponentInstanceId("btn-" + buttonKey),
    terminals
  );
  return group;
}

/**
 * Finds a terminal on a component by its local id.
 * @param {Konva.Group} component - Component group with terminals metadata.
 * @param {string} terminalId - Terminal id within the component.
 */
function findTerminal(component, terminalId) {
  if (!component.terminals) {
    return null;
  }

  for (let i = 0; i < component.terminals.length; i += 1) {
    if (component.terminals[i].id === terminalId) {
      return component.terminals[i];
    }
  }

  return null;
}

/**
 * Creates all doorbell lab components at diagram-aligned default positions.
 * @param {number} stageWidth - Konva stage width for horizontal centering.
 * @param {number} stageHeight - Konva stage height for vertical layout.
 */
function createDefaultLayout(stageWidth, stageHeight) {
  const centerX = stageWidth / 2;
  const margin = 40;

  return {
    chime: makeChime(margin, margin),
    transformer: makeTransformer(stageWidth - margin - 150, margin),
    terminalBlock: makeTerminalBlock(centerX - 140, stageHeight * 0.42),
    power: makePower(margin, stageHeight - margin - 88),
    buttonFront: makeButton("Front", centerX - 160, stageHeight - margin - 78),
    buttonRear: makeButton("Rear", centerX - 48, stageHeight - margin - 78),
    buttonSide: makeButton("Side", centerX + 64, stageHeight - margin - 78),
  };
}
