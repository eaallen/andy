import Konva from "konva";
import { COMPONENT_TYPES, TERMINAL_ROLES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addComponentShell,
  addPowerSourceSymbol,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";

/**
 * Creates a power source with configurable hot legs plus N and G.
 * Default is one hot leg (L1). Set legs ≥ 2 for multi-wire / multi-phase feeds.
 * Icon is the schematic AC voltage source (circle + sine) unless kind is "dc".
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 * @param {{ legs?: number; kind?: "ac"|"dc" }} [options] - Power options; legs defaults to 1, kind to "ac".
 */
export function makePower(x, y, options) {
  const legs = options && options.legs != null ? options.legs : 1;
  const kind = options && options.kind === "dc" ? "dc" : "ac";
  const group = new Konva.Group({ x: x, y: y });
  const terminalCount = legs + 2;
  const shellWidth = Math.max(110, terminalCount * 28 + 24);
  const shell = addComponentShell(group, shellWidth, 88, "Power");

  addPowerSourceSymbol(group, shell.width / 2, 42, 16, kind);

  group.add(
    new Konva.Text({
      x: 12,
      y: 62,
      text: legs >= 2 ? "120/240V" : "120V",
      fontSize: 11,
      fontFamily: "system-ui, Arial, sans-serif",
      fill: "#71717a",
      listening: false,
    })
  );

  const terminalY = -TERMINAL_OUTSET;
  const spacing = shell.width / (terminalCount + 1);
  const edge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const legColors = ["blue", "red", "blue", "red"];
  const terminals = [];

  for (let i = 1; i <= legs; i += 1) {
    const id = "l" + i;
    const role =
      i === 1 ? TERMINAL_ROLES.L1 : i === 2 ? TERMINAL_ROLES.L2 : id;
    terminals.push(
      addTerminal(group, spacing * i, terminalY, id, "L" + i, {
        role: role,
        wireColor: legColors[(i - 1) % legColors.length],
        labelPlacement: "above",
        ...edge,
      })
    );
  }

  terminals.push(
    addTerminal(group, spacing * (legs + 1), terminalY, "n", "N", {
      role: TERMINAL_ROLES.NEUTRAL,
      wireColor: "gray",
      labelPlacement: "above",
      ...edge,
    })
  );
  terminals.push(
    addTerminal(group, spacing * (legs + 2), terminalY, "g", "G", {
      role: TERMINAL_ROLES.GROUND,
      wireColor: "green",
      labelPlacement: "above",
      ...edge,
    })
  );

  group.powerLegs = legs;
  group.powerKind = kind;
  initComponent(group, COMPONENT_TYPES.POWER, nextComponentInstanceId("power"), terminals);
  return group;
}
