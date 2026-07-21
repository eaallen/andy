import Konva from "konva";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";
import {
  addSpstToggleSymbol,
  addSwitchHitAndHint,
  addSwitchShell,
  applySwitchVisual,
} from "./switch-shared.js";

/**
 * Creates a 4-way toggle switch with traveler pairs A1/A2 and B1/B2.
 * Open (straight): A1↔B1 and A2↔B2. Closed (cross): A1↔B2 and A2↔B1.
 * @param {string} label - Switch label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeFourWay(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "4-Way";
  const shell = addSwitchShell(group, 140, 110, title);

  addSpstToggleSymbol(group, shell.width / 2, 40, 48);
  addSwitchHitAndHint(group, shell.width, 86, "Straight");

  const topY = -TERMINAL_OUTSET;
  const bottomY = shell.height + TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const topEdge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const bottomEdge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, topY, "a1", "A1", {
      role: TERMINAL_ROLES.FOUR_WAY_A1,
      wireColor: "red",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, rightX, topY, "a2", "A2", {
      role: TERMINAL_ROLES.FOUR_WAY_A2,
      wireColor: "red",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, leftX, bottomY, "b1", "B1", {
      role: TERMINAL_ROLES.FOUR_WAY_B1,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, rightX, bottomY, "b2", "B2", {
      role: TERMINAL_ROLES.FOUR_WAY_B2,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
  ];

  group.isSwitch = true;
  group.isToggle = true;
  group.switchKind = "four-way";
  group.isClosed = false;
  group.isPressed = false;

  initComponent(
    group,
    COMPONENT_TYPES.FOUR_WAY,
    nextComponentInstanceId("four-way"),
    terminals
  );
  applySwitchVisual(group, { closed: false });
  return group;
}
