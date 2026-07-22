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
  addSwitchBridges,
  addSwitchButton,
  addSwitchShell,
  applySwitchVisual,
  bindSwitchBridgeRefresh,
} from "./switch-shared.js";

/**
 * Creates an SPST toggle switch with COM and NO terminals.
 * Click toggles closed/open; when closed, COM bridges to NO.
 * @param {string} label - Switch label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeSwitch(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Switch";
  const shell = addSwitchShell(group, 110, 88, title);

  addSwitchBridges(group, 1);
  addSwitchButton(group, shell.width, "Open");
  addSpstToggleSymbol(group, shell.width);

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
  group.switchKind = "spst";
  group.isClosed = false;
  group.isPressed = false;

  initComponent(
    group,
    COMPONENT_TYPES.SWITCH,
    nextComponentInstanceId("switch"),
    terminals
  );
  bindSwitchBridgeRefresh(group);
  applySwitchVisual(group, { closed: false });
  return group;
}
