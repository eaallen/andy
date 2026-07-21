import Konva from "konva";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";

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
 * Creates a momentary doorbell button with common and signal terminals.
 * @param {"Front" | "Rear" | "Side"} label - Button label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeButton(label, x, y) {
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
