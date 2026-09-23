import Konva from "konva";
import { COMPONENT_TYPES } from "./constants.js";
import {
  TERMINAL_OUTSET,
  addComponentShell,
  addMeasurementReadout,
  addTerminal,
  initComponent,
  nextComponentInstanceId,
} from "./shared.js";
import { DEFAULT_RESISTOR_OHMS } from "../electrical.js";
import { formatOhms } from "../circuit-format.js";

/**
 * Updates a resistor's shell / zigzag for energized vs idle.
 * @param {Konva.Group} resistor - Resistor component from makeResistor.
 * @param {{ energized?: boolean }} state - Visual state flags.
 */
export function applyResistorVisual(resistor, state) {
  const live = !!(state && state.energized);
  resistor.isEnergized = live;
  const shell = resistor.findOne(".component-shell");
  const zig = resistor.resistorZig;
  const ohmsLabel = resistor.resistorOhmsLabel;

  if (shell) {
    shell.fill(live ? "#fff7ed" : "#f0f9ff");
    shell.stroke(live ? "#ea580c" : "#7dd3fc");
  }
  if (zig) {
    zig.stroke(live ? "#c2410c" : "#57534e");
    zig.strokeWidth(live ? 3 : 2.5);
  }
  if (ohmsLabel) {
    ohmsLabel.fill(live ? "#9a3412" : "#71717a");
  }
}

/**
 * Creates a two-terminal resistor with schematic zigzag body.
 * @param {string} label - Resistor label shown on the component.
 * @param {number} x - Group x position on the stage.
 * @param {number} y - Group y position on the stage.
 * @param {{ ohms?: number }} [options] - Resistance in ohms (default 100).
 */
export function makeResistor(label, x, y, options) {
  const ohms =
    options && options.ohms != null && options.ohms > 0
      ? options.ohms
      : DEFAULT_RESISTOR_OHMS;
  const group = new Konva.Group({ x: x, y: y });
  const title = label || "Resistor";
  const shell = addComponentShell(group, 110, 100, title);

  const cx = shell.width / 2;
  const cy = 48;
  // Zigzag resistor symbol.
  const zig = new Konva.Line({
    points: [
      cx - 28,
      cy,
      cx - 20,
      cy - 10,
      cx - 12,
      cy + 10,
      cx - 4,
      cy - 10,
      cx + 4,
      cy + 10,
      cx + 12,
      cy - 10,
      cx + 20,
      cy + 10,
      cx + 28,
      cy,
    ],
    stroke: "#57534e",
    strokeWidth: 2.5,
    lineCap: "round",
    lineJoin: "round",
    listening: false,
    name: "resistor-zig",
  });
  group.add(zig);

  const ohmsLabel = new Konva.Text({
    x: 10,
    y: 62,
    width: shell.width - 20,
    align: "center",
    text: formatOhms(ohms),
    fontSize: 11,
    fontFamily: "system-ui, Arial, sans-serif",
    fill: "#71717a",
    listening: false,
    name: "resistor-ohms-label",
  });
  group.add(ohmsLabel);
  addMeasurementReadout(group, 6, 76, shell.width - 12);

  group.ohms = ohms;
  group.resistorZig = zig;
  group.resistorOhmsLabel = ohmsLabel;
  group.measurementOmitsOhms = true;
  group.isEnergized = false;
  group.setEnergized = function (live) {
    applyResistorVisual(group, { energized: live });
  };

  const terminalY = shell.height + TERMINAL_OUTSET;
  const leftX = shell.width / 3;
  const rightX = (shell.width / 3) * 2;
  const edge = { side: "bottom", shellWidth: shell.width, shellHeight: shell.height };
  const terminals = [
    addTerminal(group, leftX, terminalY, "a", "A", {
      wireColor: "black",
      labelPlacement: "below",
      ...edge,
    }),
    addTerminal(group, rightX, terminalY, "b", "B", {
      wireColor: "black",
      labelPlacement: "below",
      ...edge,
    }),
  ];

  initComponent(group, COMPONENT_TYPES.RESISTOR, nextComponentInstanceId("resistor"), terminals);
  return group;
}
