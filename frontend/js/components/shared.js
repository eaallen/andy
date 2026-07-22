import Konva from "konva";
import { TERMINAL_ROLES, WIRE_COLORS } from "./constants.js";

// Global, used to keep track of the next component id to be assigned.
let nextComponentId = 0;

/**
 * Allocates a unique id string for a component instance.
 * @param {string} prefix - Short type prefix (e.g. "power", "btn-front").
 */
export function nextComponentInstanceId(prefix) {
  nextComponentId += 1;
  return prefix + "-" + nextComponentId;
}

/**
 * Converts a container-absolute point into a node's local coordinate space.
 * Used so wire endpoints stay anchored to terminals under stage pan/zoom.
 * @param {{ x: number; y: number }} absPoint - Point in stage-container pixels.
 * @param {Konva.Node} node - Node whose absolute transform defines the local space.
 */
export function absoluteToLocal(absPoint, node) {
  const transform = node.getAbsoluteTransform().copy().invert();
  return transform.point(absPoint);
}

/**
 * Returns terminal center in stage-local (world) coordinates, or in
 * `relativeTo`'s local space when provided (e.g. the wire layer).
 * @param {{ node: Konva.Circle, handle?: Konva.Group }} terminal - Terminal metadata object.
 * @param {Konva.Node} [relativeTo] - Optional local space (defaults to the stage).
 */
export function getTerminalPosition(terminal, relativeTo) {
  const node = terminal.handle || terminal.node;
  const abs = node.getAbsolutePosition();
  const space = relativeTo || node.getStage();
  if (!space) {
    return abs;
  }
  return absoluteToLocal(abs, space);
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
export function initComponent(group, componentType, instanceId, terminals) {
  group.componentType = componentType;
  group.componentId = instanceId;
  group.terminals = terminals;
  group.draggable(true);
  // Require intentional movement so clicks (terminals, doorbell) are not treated as drags.
  group.dragDistance(10);
}

/** Distance from a shell edge to a terminal center (terminals sit just outside). */
export const TERMINAL_OUTSET = 16;

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
export function addTerminal(group, x, y, id, label, opts) {
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
      stage.container().style.cursor = "grab";
      handle.fire("terminalslideend");
    }

    stage.on("mousemove.terminalSlide touchmove.terminalSlide", onMove);
    stage.on("mouseup.terminalSlide touchend.terminalSlide", onUp);
  }

  terminal.beginSlide = beginSlide;
  terminal.slideToPointer = slideToPointer;

  handle.on("mousedown touchstart", function (evt) {
    if (typeof terminal.onPointerDown === "function") {
      terminal.onPointerDown(evt);
      return;
    }
    beginSlide(evt);
  });

  return terminal;
}

/**
 * Draws a blue-tinted component box with title and subtle shadow.
 * Matches the React lab Module shell (fill #f0f9ff, stroke #7dd3fc).
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
export function addComponentShell(group, width, height, title) {
  // listening: true so dragging the box moves the component group.
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
 * Draws a simple SPST switch symbol (open contacts with actuator).
 * Used as a static decoration (e.g. on the power source).
 * @param {Konva.Group} group - Parent group.
 * @param {number} x - Local x of symbol center.
 * @param {number} y - Local y of symbol center.
 * @param {number} width - Symbol width.
 */
export function addSwitchSymbol(group, x, y, width) {
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
export function addGroundSymbol(group, x, y) {
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
