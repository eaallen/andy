import Konva from "konva";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addComponentShell,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";

/**
 * Creates a chime with Front, Trans, and Rear terminals (top-left layout).
 * Rear is shared by the Rear and Side doorbell buttons.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeChime(x, y) {
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
