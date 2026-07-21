import Konva from "konva";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addComponentShell,
  addGroundSymbol,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";

/**
 * Creates a 120 V to 24 V transformer with primary and secondary terminals (top-right layout).
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeTransformer(x, y) {
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
