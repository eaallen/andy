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
 * Updates a lamp bulb glow for energized / off state.
 * @param {Konva.Group} lamp - Lamp component from makeLamp.
 * @param {{ lit?: boolean }} state - Visual state flags.
 */
export function applyLampVisual(lamp, state) {
  const lit = !!state.lit;
  lamp.isLit = lit;
  const bulb = lamp.lampBulb;
  const glow = lamp.lampGlow;
  const filament = lamp.lampFilament;

  if (bulb) {
    bulb.fill(lit ? "#fef08a" : "#f4f4f5");
    bulb.stroke(lit ? "#ca8a04" : "#a1a1aa");
  }
  if (glow) {
    glow.visible(lit);
  }
  if (filament) {
    filament.stroke(lit ? "#a16207" : "#d4d4d8");
  }
}

/**
 * Creates a lamp load with hot and neutral terminals.
 * @param {string} label - Lamp label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 */
export function makeLamp(label, x, y) {
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Lamp";
  const shell = addComponentShell(group, 100, 96, title);

  const cx = shell.width / 2;
  const cy = 52;

  const glow = new Konva.Circle({
    x: cx,
    y: cy,
    radius: 22,
    fill: "rgba(250, 204, 21, 0.35)",
    listening: false,
    visible: false,
    name: "lamp-glow",
  });
  group.add(glow);

  const bulb = new Konva.Circle({
    x: cx,
    y: cy,
    radius: 16,
    fill: "#f4f4f5",
    stroke: "#a1a1aa",
    strokeWidth: 2,
    listening: false,
    name: "lamp-bulb",
  });
  group.add(bulb);

  const filament = new Konva.Line({
    points: [cx - 6, cy + 2, cx, cy - 6, cx + 6, cy + 2],
    stroke: "#d4d4d8",
    strokeWidth: 1.5,
    lineCap: "round",
    lineJoin: "round",
    listening: false,
    name: "lamp-filament",
  });
  group.add(filament);

  group.lampGlow = glow;
  group.lampBulb = bulb;
  group.lampFilament = filament;
  group.isLit = false;

  const terminalY = shell.height + TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const edge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, terminalY, "hot", "Hot", {
      role: TERMINAL_ROLES.LOAD_HOT,
      wireColor: "red",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, rightX, terminalY, "n", "N", {
      role: TERMINAL_ROLES.LOAD_NEUTRAL,
      wireColor: "gray",
      labelPlacement: "below",
      ...edge,
    }),
  ];

  initComponent(group, COMPONENT_TYPES.LAMP, nextComponentInstanceId("lamp"), terminals);
  return group;
}
