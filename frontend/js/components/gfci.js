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
 * Creates a GFCI receptacle with LINE and LOAD hot/neutral/ground terminals.
 * LINE always bridges to LOAD (device not tripped) for continuity labs.
 * @param {string} label - GFCI label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeGfci(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "GFCI";
  const shell = addComponentShell(group, 160, 110, title);

  group.add(
    new Konva.Text({
      x: 10,
      y: 30,
      text: "LINE",
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#b45309",
      listening: false,
    })
  );
  group.add(
    new Konva.Text({
      x: 10,
      y: 78,
      text: "LOAD",
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#1d4ed8",
      listening: false,
    })
  );
  group.add(
    new Konva.Rect({
      x: shell.width / 2 - 16,
      y: 40,
      width: 32,
      height: 40,
      fill: "#fafafa",
      stroke: "#a1a1aa",
      strokeWidth: 2,
      cornerRadius: 4,
      listening: false,
    })
  );

  const topY = -TERMINAL_OUTSET;
  const bottomY = shell.height + TERMINAL_OUTSET;
  const spacing = shell.width / 4;
  const topEdge = { side: "top", shellWidth: shell.width, shellHeight: shell.height };
  const bottomEdge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, spacing, topY, "line-hot", "Hot", {
      role: TERMINAL_ROLES.LINE_HOT,
      wireColor: "red",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, spacing * 2, topY, "line-n", "N", {
      role: TERMINAL_ROLES.LINE_NEUTRAL,
      wireColor: "gray",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, spacing * 3, topY, "line-g", "G", {
      role: TERMINAL_ROLES.LINE_GROUND,
      wireColor: "green",
      labelPlacement: "above",
      ...topEdge,
    }),
    addTerminal(group, spacing, bottomY, "load-hot", "Hot", {
      role: TERMINAL_ROLES.LOAD_SIDE_HOT,
      wireColor: "red",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, spacing * 2, bottomY, "load-n", "N", {
      role: TERMINAL_ROLES.LOAD_SIDE_NEUTRAL,
      wireColor: "gray",
      labelPlacement: "below",
      ...bottomEdge,
    }),
    addTerminal(group, spacing * 3, bottomY, "load-g", "G", {
      role: TERMINAL_ROLES.LOAD_SIDE_GROUND,
      wireColor: "green",
      labelPlacement: "below",
      ...bottomEdge,
    }),
  ];

  group.hasInternalBridges = true;

  initComponent(
    group,
    COMPONENT_TYPES.GFCI,
    nextComponentInstanceId("gfci"),
    terminals
  );
  return group;
}
