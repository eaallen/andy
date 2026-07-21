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
 * Creates a terminal block with 120 V and low-voltage junction dots (center layout).
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeTerminalBlock(x, y) {
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
