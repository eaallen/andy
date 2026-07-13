import Konva from "konva";

/**
 * Component type identifiers used across lab layouts.
 */
export const COMPONENT_TYPES = {
  POWER: "power",
  TRANSFORMER: "transformer",
  CHIME: "chime",
  BUTTON: "button",
  SWITCH: "switch",
  LAMP: "lamp",
  TERMINAL_BLOCK: "terminalBlock",
};

/**
 * Terminal role identifiers for continuity tracing and grading.
 */
export const TERMINAL_ROLES = {
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
  SWITCH_COM: "switchCom",
  SWITCH_NO: "switchNo",
  LOAD_HOT: "loadHot",
  LOAD_NEUTRAL: "loadNeutral",
  JUNCTION: "junction",
};

export const WIRE_COLORS = {
  red: "#dc2626",
  gray: "#71717a",
  blue: "#2563eb",
  green: "#16a34a",
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
 * @param {{ node: Konva.Circle, handle?: Konva.Group }} terminal - Terminal metadata object.
 */
export function getTerminalPosition(terminal) {
  if (terminal.handle) {
    return terminal.handle.getAbsolutePosition();
  }
  return terminal.node.getAbsolutePosition();
}

/**
 * Walks up from a terminal node to the component group that owns componentId.
 * @param {{ node: Konva.Circle, componentGroup?: Konva.Group }} terminal - Terminal metadata.
 */
export function getTerminalComponentGroup(terminal) {
  if (terminal.componentGroup) {
    return terminal.componentGroup;
  }
  let node = terminal.node ? terminal.node.getParent() : null;
  while (node && !node.componentId) {
    node = node.getParent();
  }
  return node;
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
  // Require intentional movement so clicks (terminals, doorbell) are not treated as drags.
  group.dragDistance(10);
}

/** Distance from a shell edge to a terminal center (terminals sit just outside). */
const TERMINAL_OUTSET = 16;

/** Pointer travel (px) before a terminal press counts as an edge-slide instead of a click. */
const TERMINAL_SLIDE_THRESHOLD = 8;

/**
 * Clamps a number into an inclusive range.
 * @param {number} value - Input value.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Keeps a terminal on one shell side at a fixed outset (slide along, not in/out).
 * @param {{ x: number, y: number }} pos - Proposed local position in the component group.
 * @param {"top"|"bottom"|"left"|"right"} side - Edge the terminal is attached to.
 * @param {number} shellWidth - Component box width.
 * @param {number} shellHeight - Component box height.
 * @param {number} outset - Distance outside the box edge.
 */
function constrainTerminalAlongSide(pos, side, shellWidth, shellHeight, outset) {
  const edgePad = 10;
  if (side === "top") {
    return {
      x: clamp(pos.x, edgePad, shellWidth - edgePad),
      y: -outset,
    };
  }
  if (side === "bottom") {
    return {
      x: clamp(pos.x, edgePad, shellWidth - edgePad),
      y: shellHeight + outset,
    };
  }
  if (side === "left") {
    return {
      x: -outset,
      y: clamp(pos.y, edgePad, shellHeight - edgePad),
    };
  }
  return {
    x: shellWidth + outset,
    y: clamp(pos.y, edgePad, shellHeight - edgePad),
  };
}

/**
 * Places a label relative to a terminal circle at the handle origin (0, 0).
 * @param {Konva.Text} text - Label node.
 * @param {number} radius - Terminal circle radius.
 * @param {"right"|"left"|"above"|"below"} placement - Label side relative to the circle.
 */
function positionTerminalLabel(text, radius, placement) {
  if (placement === "above") {
    text.x(-text.width() / 2);
    text.y(-radius - text.height() - 2);
  } else if (placement === "below") {
    text.x(-text.width() / 2);
    text.y(radius + 2);
  } else if (placement === "left") {
    text.x(-radius - text.width() - 4);
    text.y(-text.height() / 2);
  } else {
    text.x(radius + 4);
    text.y(-text.height() / 2);
  }
}

/**
 * Draws a labeled terminal just outside a component shell.
 * Drag slides it along its edge only (fixed distance from the box).
 * @param {Konva.Group} group - Parent component group.
 * @param {number} x - Local x of the terminal center.
 * @param {number} y - Local y of the terminal center.
 * @param {string} id - Terminal id within the component.
 * @param {string} label - Short label shown beside the terminal.
 * @param {{ role?: string, wireColor?: string, radius?: number, labelPlacement?: "right"|"left"|"above"|"below", side: "top"|"bottom"|"left"|"right", shellWidth: number, shellHeight: number }} opts - Terminal options.
 */
function addTerminal(group, x, y, id, label, opts) {
  const options = opts || {};
  const radius = options.radius || 7;
  const fill = WIRE_COLORS[options.wireColor] || WIRE_COLORS.gray;
  const placement = options.labelPlacement || "right";
  const side = options.side || "top";
  const shellWidth = options.shellWidth || 100;
  const shellHeight = options.shellHeight || 80;
  const outset = TERMINAL_OUTSET;

  const start = constrainTerminalAlongSide(
    { x: x, y: y },
    side,
    shellWidth,
    shellHeight,
    outset
  );

  const handle = new Konva.Group({
    x: start.x,
    y: start.y,
    draggable: false,
    name: "terminal-handle",
  });

  const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: radius,
    fill: fill,
    stroke: "#ffffff",
    strokeWidth: 2,
    hitStrokeWidth: 20,
    name: "terminal",
  });

  const text = new Konva.Text({
    text: label,
    fontSize: 11,
    fontFamily: "system-ui, Arial, sans-serif",
    fontStyle: "bold",
    fill: "#3f3f46",
    listening: false,
  });
  positionTerminalLabel(text, radius, placement);

  handle.add(circle);
  handle.add(text);
  group.add(handle);

  const terminal = {
    id: id,
    label: label,
    role: options.role || TERMINAL_ROLES.JUNCTION,
    wireColor: options.wireColor || "gray",
    side: side,
    node: circle,
    handle: handle,
    componentGroup: group,
    didSlide: false,
    getPosition: function () {
      return getTerminalPosition(this);
    },
  };

  /**
   * Slides the terminal to the current pointer, clamped to the shell edge.
   * @param {Konva.Stage} stage - Active stage.
   */
  function slideToPointer(stage) {
    const abs = stage.getPointerPosition();
    if (!abs) {
      return;
    }
    const toLocal = group.getAbsoluteTransform().copy().invert();
    const local = toLocal.point(abs);
    const constrained = constrainTerminalAlongSide(
      local,
      side,
      shellWidth,
      shellHeight,
      outset
    );
    if (constrained.x !== handle.x() || constrained.y !== handle.y()) {
      terminal.didSlide = true;
    }
    handle.position(constrained);
    handle.fire("terminalslide");
  }

  /**
   * Starts an edge-slide gesture; ignores parent component dragging.
   * @param {Konva.KonvaEventObject} evt - Pointer down event.
   */
  function beginSlide(evt) {
    evt.cancelBubble = true;
    if (evt.evt && evt.evt.preventDefault) {
      evt.evt.preventDefault();
    }

    const stage = group.getStage();
    if (!stage) {
      return;
    }

    const startPointer = stage.getPointerPosition();
    if (!startPointer) {
      return;
    }

    terminal.didSlide = false;
    let sliding = false;
    group.draggable(false);
    if (typeof group.stopDrag === "function") {
      group.stopDrag();
    }

    /**
     * Follows the pointer once movement exceeds the slide threshold.
     */
    function onMove() {
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      if (!sliding) {
        const dx = pointer.x - startPointer.x;
        const dy = pointer.y - startPointer.y;
        if (dx * dx + dy * dy < TERMINAL_SLIDE_THRESHOLD * TERMINAL_SLIDE_THRESHOLD) {
          return;
        }
        sliding = true;
        stage.container().style.cursor = "grabbing";
      }
      slideToPointer(stage);
      stage.batchDraw();
    }

    /**
     * Ends the slide gesture and restores component dragging.
     */
    function onUp() {
      stage.off(".terminalSlide");
      group.draggable(true);
      stage.container().style.cursor = "default";
      handle.fire("terminalslideend");
    }

    stage.on("mousemove.terminalSlide touchmove.terminalSlide", onMove);
    stage.on("mouseup.terminalSlide touchend.terminalSlide", onUp);
  }

  handle.on("mousedown touchstart", beginSlide);

  return terminal;
}

/**
 * Draws a white component box with title and subtle shadow.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
function addComponentShell(group, width, height, title) {
  // listening: true so dragging the white box moves the component group.
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
    name: "component-shell",
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
 * Draws a tinted shell used for interactive doorbell buttons.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
function addButtonShell(group, width, height, title) {
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
  });

  group.add(rect);
  group.add(titleText);

  return { width: width, height: height };
}

/**
 * Draws a tinted shell used for SPST toggle switches.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
function addSwitchShell(group, width, height, title) {
  const rect = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: "#f0fdf4",
    stroke: "#86efac",
    strokeWidth: 2,
    cornerRadius: 8,
    shadowColor: "rgba(22, 163, 74, 0.12)",
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
    fill: "#166534",
    listening: false,
  });

  group.add(rect);
  group.add(titleText);

  return { width: width, height: height };
}

/**
 * Draws a raised circular press pad inside a doorbell button component.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} centerX - Pad center x in local coordinates.
 * @param {number} centerY - Pad center y in local coordinates.
 * @param {number} shellWidth - Component width for centering the hint label.
 */
function addPressButtonPad(group, centerX, centerY, shellWidth) {
  const padRadius = 22;

  const pad = new Konva.Circle({
    x: centerX,
    y: centerY,
    radius: padRadius,
    fill: "#3b82f6",
    stroke: "#1d4ed8",
    strokeWidth: 2,
    shadowColor: "rgba(29, 78, 216, 0.5)",
    shadowBlur: 10,
    shadowOffsetY: 4,
    hitStrokeWidth: 10,
    name: "button-pad",
  });

  group.add(pad);

  group.add(
    new Konva.Circle({
      x: centerX,
      y: centerY,
      radius: 11,
      stroke: "rgba(255,255,255,0.75)",
      strokeWidth: 2,
      listening: false,
      name: "button-pad-ring",
    })
  );

  group.add(
    new Konva.Text({
      x: 0,
      y: centerY + padRadius + 5,
      width: shellWidth,
      align: "center",
      text: "Press",
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#2563eb",
      listening: false,
      name: "button-hint",
    })
  );

  group.buttonPad = pad;
  group.padBaseY = centerY;
  return pad;
}

/**
 * Updates doorbell button shell and pad colors for hover and press states.
 * @param {Konva.Group} button - Button component group from makeButton.
 * @param {{ pressed?: boolean, hovered?: boolean }} state - Visual state flags.
 */
export function applyDoorbellButtonVisual(button, state) {
  const pressed = !!state.pressed;
  const hovered = !!state.hovered && !pressed;
  const shell = button.findOne(".component-shell");
  const pad = button.buttonPad;
  const baseY = button.padBaseY;

  if (shell) {
    shell.fill(pressed ? "#dbeafe" : hovered ? "#e0f2fe" : "#f0f9ff");
    shell.stroke(pressed ? "#2563eb" : hovered ? "#38bdf8" : "#7dd3fc");
  }

  if (pad && typeof baseY === "number") {
    if (pressed) {
      pad.fill("#1d4ed8");
      pad.stroke("#1e3a8a");
      pad.shadowBlur(2);
      pad.shadowOffsetY(1);
      pad.y(baseY + 2);
    } else if (hovered) {
      pad.fill("#2563eb");
      pad.stroke("#1d4ed8");
      pad.shadowBlur(14);
      pad.shadowOffsetY(5);
      pad.y(baseY);
    } else {
      pad.fill("#3b82f6");
      pad.stroke("#1d4ed8");
      pad.shadowBlur(10);
      pad.shadowOffsetY(4);
      pad.y(baseY);
    }
  }
}

/**
 * Draws a simple SPST switch symbol (open contacts with actuator).
 * Used as a static decoration (e.g. on the power source).
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
 * Draws an interactive SPST toggle symbol and stores the actuator for later updates.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} x - Local x of symbol center.
 * @param {number} y - Local y of symbol center.
 * @param {number} width - Symbol width.
 */
function addSpstToggleSymbol(group, x, y, width) {
  const half = width / 2;
  const contactY = y + 6;
  const hingeX = x - half + 10;
  const openEndX = x + half - 4;
  const openEndY = contactY - 10;
  const closedEndX = x + half - 10;
  const closedEndY = contactY;

  group.add(
    new Konva.Line({
      points: [x - half, contactY, hingeX, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [closedEndX, contactY, x + half, contactY],
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
 * Updates an SPST switch symbol and shell for open/closed state.
 * @param {Konva.Group} sw - Switch component from makeSwitch.
 * @param {{ closed?: boolean }} state - Visual state flags.
 */
export function applySwitchVisual(sw, state) {
  const closed = !!state.closed;
  sw.isClosed = closed;
  sw.isPressed = closed;
  const shell = sw.findOne(".component-shell");
  const symbol = sw.switchSymbol;
  const hint = sw.findOne(".switch-hint");

  if (shell) {
    shell.fill(closed ? "#ecfdf5" : "#f0fdf4");
    shell.stroke(closed ? "#059669" : "#86efac");
  }

  if (symbol && symbol.actuator) {
    if (closed) {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.closedEndX,
        symbol.closedEndY,
      ]);
      symbol.actuator.stroke("#059669");
    } else {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.openEndX,
        symbol.openEndY,
      ]);
      symbol.actuator.stroke("#18181b");
    }
  }

  if (hint) {
    hint.text(closed ? "Closed" : "Open");
    hint.fill(closed ? "#047857" : "#15803d");
  }
}

/**
 * Updates a lamp bulb glow for energized / off state.
 * @param {Konva.Group} lamp - Lamp component from makeLamp.
 * @param {{ lit?: boolean }} state - Visual state flags.
 */
export function applyLampVisual(lamp, state) {
  const lit = !!state.lit;
  lamp.isLit = lit;
  const bulb = lamp.lampBulb;
  const glow = lamp.lampGlow;
  const filament = lamp.lampFilament;

  if (bulb) {
    bulb.fill(lit ? "#fef08a" : "#f4f4f5");
    bulb.stroke(lit ? "#ca8a04" : "#a1a1aa");
  }
  if (glow) {
    glow.visible(lit);
  }
  if (filament) {
    filament.stroke(lit ? "#a16207" : "#d4d4d8");
  }
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

  const terminalY = -TERMINAL_OUTSET;
  const spacing = shell.width / 4;
  const edge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, spacing, terminalY, "l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, spacing * 2, terminalY, "n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "gray",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, spacing * 3, terminalY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      labelPlacement: "above",
      ...edge,
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

  const topY = -TERMINAL_OUTSET;
  const bottomY = shell.height + TERMINAL_OUTSET;
  const topSpacing = shell.width / 4;
  const bottomSpacing = shell.width / 5;
  const topEdge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const bottomEdge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };

  const terminals = [
    addTerminal(group, topSpacing, topY, "l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, topSpacing * 2, topY, "n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "gray",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, topSpacing * 3, topY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, bottomSpacing, bottomY, "com", "COM", {
      role: TERMINAL_ROLES.COM_24V,
      wireColor: "gray",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, bottomSpacing * 2, bottomY, "sig-f", "F", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, bottomSpacing * 3, bottomY, "sig-r", "R", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, bottomSpacing * 4, bottomY, "sig-s", "S", {
      role: TERMINAL_ROLES.JUNCTION,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
  ];

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

  const topY = -TERMINAL_OUTSET;
  const bottomY = shell.height + TERMINAL_OUTSET;
  const topEdge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const bottomEdge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, 104, topY, "sec-hot", "24V", {
      role: TERMINAL_ROLES.HOT_24V,
      wireColor: "red",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, 130, topY, "sec-com", "COM", {
      role: TERMINAL_ROLES.COM_24V,
      wireColor: "gray",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, 24, bottomY, "pri-l1", "L1", {
      role: TERMINAL_ROLES.L1,
      wireColor: "blue",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, 50, bottomY, "pri-n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "gray",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, 76, bottomY, "pri-g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      labelPlacement: "below",
      ...bottomEdge,
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

  const terminalY = shell.height + TERMINAL_OUTSET;
  const spacing = shell.width / 4;
  const edge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, spacing, terminalY, "front", "Front", {
      role: TERMINAL_ROLES.CHIME_FRONT,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, spacing * 2, terminalY, "trans", "Trans", {
      role: TERMINAL_ROLES.CHIME_TRANS,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, spacing * 3, terminalY, "rear", "Rear", {
      role: TERMINAL_ROLES.CHIME_REAR,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
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
  const shell = addButtonShell(group, 96, 88, label);

  addPressButtonPad(group, shell.width / 2, 46, shell.width);

  const terminalY = -TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const edge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, terminalY, "com", "COM", {
      role: TERMINAL_ROLES.BTN_COMMON,
      wireColor: "gray",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, rightX, terminalY, "sig", "SIG", {
      role: TERMINAL_ROLES.BTN_SIGNAL,
      wireColor: "red",
      labelPlacement: "above",
      ...edge,
    }),
  ];

  const buttonKey = label.toLowerCase();
  group.buttonKey = buttonKey;
  group.isSwitch = true;
  group.isToggle = false;
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
 * Creates an SPST toggle switch with COM and NO terminals.
 * Click toggles closed/open; when closed, COM bridges to NO.
 * @param {string} label - Switch label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeSwitch(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Switch";
  const shell = addSwitchShell(group, 110, 88, title);

  addSpstToggleSymbol(group, shell.width / 2, 34, 40);

  const hit = new Konva.Rect({
    x: 8,
    y: 28,
    width: shell.width - 16,
    height: 36,
    fill: "rgba(0,0,0,0)",
    name: "switch-hit",
  });
  group.add(hit);
  group.switchHit = hit;

  group.add(
    new Konva.Text({
      x: 0,
      y: 68,
      width: shell.width,
      align: "center",
      text: "Open",
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#15803d",
      listening: false,
      name: "switch-hint",
    })
  );

  const terminalY = -TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const edge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, terminalY, "com", "COM", {
      role: TERMINAL_ROLES.SWITCH_COM,
      wireColor: "gray",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, rightX, terminalY, "no", "NO", {
      role: TERMINAL_ROLES.SWITCH_NO,
      wireColor: "red",
      labelPlacement: "above",
      ...edge,
    }),
  ];

  group.isSwitch = true;
  group.isToggle = true;
  group.isClosed = false;
  group.isPressed = false;

  initComponent(
    group,
    COMPONENT_TYPES.SWITCH,
    nextComponentInstanceId("switch"),
    terminals
  );
  applySwitchVisual(group, { closed: false });
  return group;
}

/**
 * Creates a lamp load with hot and neutral terminals.
 * @param {string} label - Lamp label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
function makeLamp(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Lamp";
  const shell = addComponentShell(group, 100, 96, title);

  const cx = shell.width / 2;
  const cy = 52;

  const glow = new Konva.Circle({
    x: cx,
    y: cy,
    radius: 22,
    fill: "rgba(250, 204, 21, 0.35)",
    listening: false,
    visible: false,
    name: "lamp-glow",
  });
  group.add(glow);

  const bulb = new Konva.Circle({
    x: cx,
    y: cy,
    radius: 16,
    fill: "#f4f4f5",
    stroke: "#a1a1aa",
    strokeWidth: 2,
    listening: false,
    name: "lamp-bulb",
  });
  group.add(bulb);

  const filament = new Konva.Line({
    points: [cx - 6, cy + 2, cx, cy - 6, cx + 6, cy + 2],
    stroke: "#d4d4d8",
    strokeWidth: 1.5,
    lineCap: "round",
    lineJoin: "round",
    listening: false,
    name: "lamp-filament",
  });
  group.add(filament);

  group.lampGlow = glow;
  group.lampBulb = bulb;
  group.lampFilament = filament;
  group.isLit = false;

  const terminalY = shell.height + TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const edge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, terminalY, "hot", "Hot", {
      role: TERMINAL_ROLES.LOAD_HOT,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, rightX, terminalY, "n", "N", {
      role: TERMINAL_ROLES.LOAD_NEUTRAL,
      wireColor: "gray",
      labelPlacement: "below",
      ...edge,
    }),
  ];

  initComponent(group, COMPONENT_TYPES.LAMP, nextComponentInstanceId("lamp"), terminals);
  return group;
}

/**
 * Finds a terminal on a component by its local id.
 * @param {Konva.Group} component - Component group with terminals metadata.
 * @param {string} terminalId - Terminal id within the component.
 */
export function findTerminal(component, terminalId) {
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
 * Registry of component type → factory. Lab files pick types from this map;
 * new device kinds require a factory here, new exercises using existing kinds do not.
 * @type {{ [type: string]: (entry: { id: string, type: string, label?: string, x: number, y: number }) => Konva.Group }}
 */
export const COMPONENT_REGISTRY = {
  power: function (entry) {
    return makePower(entry.x, entry.y);
  },
  transformer: function (entry) {
    return makeTransformer(entry.x, entry.y);
  },
  chime: function (entry) {
    return makeChime(entry.x, entry.y);
  },
  "terminal-block": function (entry) {
    return makeTerminalBlock(entry.x, entry.y);
  },
  terminalBlock: function (entry) {
    return makeTerminalBlock(entry.x, entry.y);
  },
  button: function (entry) {
    return makeButton(entry.label || entry.id, entry.x, entry.y);
  },
  switch: function (entry) {
    return makeSwitch(entry.label || entry.id, entry.x, entry.y);
  },
  lamp: function (entry) {
    return makeLamp(entry.label || entry.id, entry.x, entry.y);
  },
};

/**
 * Creates a single component instance from a normalized YAML component entry.
 * @param {{ id: string, type: string, label?: string, x: number, y: number }} entry - Resolved component.
 */
export function makeComponentFromEntry(entry) {
  const type = entry.type;
  const factory = COMPONENT_REGISTRY[type];
  if (!factory) {
    throw new Error('Unknown component type "' + type + '" for id "' + entry.id + '".');
  }
  return factory(entry);
}

/**
 * Builds a component map from a normalized lab config and stage size.
 * @param {{ components: Array<object>, margin: number }} config - Normalized lab config.
 * @param {number} stageWidth - Konva stage width.
 * @param {number} stageHeight - Konva stage height.
 * @param {(value: number|string, axis: "x"|"y", stage: object) => number} resolveCoord - Coordinate resolver.
 */
export function createLayoutFromConfig(config, stageWidth, stageHeight, resolveCoord) {
  const stage = {
    width: stageWidth,
    height: stageHeight,
    margin: config.margin,
  };
  const map = {};

  for (let i = 0; i < config.components.length; i += 1) {
    const entry = config.components[i];
    const resolved = {
      id: entry.id,
      type: entry.type,
      label: entry.label,
      x: resolveCoord(entry.x, "x", stage),
      y: resolveCoord(entry.y, "y", stage),
    };
    const group = makeComponentFromEntry(resolved);
    group.configId = entry.id;
    map[entry.id] = group;
  }

  return map;
}
