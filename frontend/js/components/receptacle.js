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
 * Creates a duplex receptacle with hot, neutral, and ground terminals.
 * @param {string} label - Receptacle label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeReceptacle(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Receptacle";
  const shell = addComponentShell(group, 120, 100, title);

  const cx = shell.width / 2;
  group.add(
    new Konva.Rect({
      x: cx - 18,
      y: 28,
      width: 36,
      height: 48,
      fill: "#fafafa",
      stroke: "#a1a1aa",
      strokeWidth: 2,
      cornerRadius: 4,
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: cx - 10,
      y: 36,
      width: 6,
      height: 14,
      fill: "#52525b",
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: cx + 4,
      y: 36,
      width: 6,
      height: 14,
      fill: "#52525b",
      listening: false,
    })
  );
  group.add(
    new Konva.Circle({
      x: cx,
      y: 62,
      radius: 3,
      fill: "#52525b",
      listening: false,
    })
  );

  const terminalY = shell.height + TERMINAL_OUTSET;
  const spacing = shell.width / 4;
  const edge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, spacing, terminalY, "hot", "Hot", {
      role: TERMINAL_ROLES.LOAD_HOT,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, spacing * 2, terminalY, "n", "N", {
      role: TERMINAL_ROLES.LOAD_NEUTRAL,
      wireColor: "gray",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, spacing * 3, terminalY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      labelPlacement: "below",
      ...edge,
    }),
  ];

  initComponent(
    group,
    COMPONENT_TYPES.RECEPTACLE,
    nextComponentInstanceId("receptacle"),
    terminals
  );
  return group;
}
