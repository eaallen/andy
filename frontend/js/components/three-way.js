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
 * Creates a 3-way (SPDT) toggle switch with COM, T1, and T2 terminals.
 * Always bridges COM to T1 (open) or T2 (closed).
 * @param {string} label - Switch label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeThreeWay(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "3-Way";
  const shell = addSwitchShell(group, 130, 96, title);

  addSpstToggleSymbol(group, shell.width / 2, 34, 44);
  addSwitchHitAndHint(group, shell.width, 72, "T1");

  const terminalY = -TERMINAL_OUTSET;
  const spacing = shell.width / 4;
  const edge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, spacing, terminalY, "t1", "T1", {
      role: TERMINAL_ROLES.TRAVELER_1,
      wireColor: "red",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, spacing * 2, terminalY, "com", "COM", {
      role: TERMINAL_ROLES.SWITCH_COM,
      wireColor: "blue",
      labelPlacement: "above",
      ...edge,
    }),
    addTerminal(group, spacing * 3, terminalY, "t2", "T2", {
      role: TERMINAL_ROLES.TRAVELER_2,
      wireColor: "red",
      labelPlacement: "above",
      ...edge,
    }),
  ];

  group.isSwitch = true;
  group.isToggle = true;
  group.switchKind = "three-way";
  group.isClosed = false;
  group.isPressed = false;

  initComponent(
    group,
    COMPONENT_TYPES.THREE_WAY,
    nextComponentInstanceId("three-way"),
    terminals
  );
  applySwitchVisual(group, { closed: false });
  return group;
}
