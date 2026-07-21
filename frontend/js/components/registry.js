import { makeButton } from "./button.js";
import { makeChime } from "./chime.js";
import { makeFourWay } from "./four-way.js";
import { makeGfci } from "./gfci.js";
import { makeLamp } from "./lamp.js";
import { makePower } from "./power.js";
import { makeReceptacle } from "./receptacle.js";
import { makeSwitch } from "./switch.js";
import { makeTerminalBlock } from "./terminal-block.js";
import { makeThreeWay } from "./three-way.js";
import { makeTransformer } from "./transformer.js";

/**
 * Registry of component type → factory. Lab files pick types from this map;
 * new device kinds require a factory here, new exercises using existing kinds do not.
 * @type {{ [type: string]: (entry: { id: string, type: string, label?: string, x: number, y: number }) => Konva.Group }}
 */
export const COMPONENT_REGISTRY = {
  power: function (entry) {
    return makePower(entry.x, entry.y, { legs: entry.legs });
  },
  transformer: function (entry) {
    return makeTransformer(entry.x, entry.y);
  },
  chime: function (entry) {
    return makeChime(entry.x, entry.y);
  },
  "terminal-block": function (entry) {
    return makeTerminalBlock(entry.x, entry.y);
  },
  terminalBlock: function (entry) {
    return makeTerminalBlock(entry.x, entry.y);
  },
  button: function (entry) {
    return makeButton(entry.label || entry.id, entry.x, entry.y);
  },
  switch: function (entry) {
    return makeSwitch(entry.label || entry.id, entry.x, entry.y);
  },
  "three-way": function (entry) {
    return makeThreeWay(entry.label || entry.id, entry.x, entry.y);
  },
  threeWay: function (entry) {
    return makeThreeWay(entry.label || entry.id, entry.x, entry.y);
  },
  "four-way": function (entry) {
    return makeFourWay(entry.label || entry.id, entry.x, entry.y);
  },
  fourWay: function (entry) {
    return makeFourWay(entry.label || entry.id, entry.x, entry.y);
  },
  lamp: function (entry) {
    return makeLamp(entry.label || entry.id, entry.x, entry.y);
  },
  receptacle: function (entry) {
    return makeReceptacle(entry.label || entry.id, entry.x, entry.y);
  },
  gfci: function (entry) {
    return makeGfci(entry.label || entry.id, entry.x, entry.y);
  },
};

/**
 * Creates a single component instance from a normalized YAML component entry.
 * @param {{ id: string, type: string, label?: string, x: number, y: number, legs?: number }} entry - Resolved component.
 */
export function makeComponentFromEntry(entry) {
  const type = entry.type;
  const factory = COMPONENT_REGISTRY[type];
  if (!factory) {
    throw new Error('Unknown component type "' + type + '" for id "' + entry.id + '".');
  }
  return factory(entry);
}

/**
 * Builds a component map from a normalized lab config and stage size.
 * @param {{ components: Array<object>, margin: number }} config - Normalized lab config.
 * @param {number} stageWidth - Konva stage width.
 * @param {number} stageHeight - Konva stage height.
 * @param {(value: number|string, axis: "x"|"y", stage: object) => number} resolveCoord - Coordinate resolver.
 */
export function createLayoutFromConfig(config, stageWidth, stageHeight, resolveCoord) {
  const stage = {
    width: stageWidth,
    height: stageHeight,
    margin: config.margin,
  };
  const map = {};

  for (let i = 0; i < config.components.length; i += 1) {
    const entry = config.components[i];
    const resolved = {
      id: entry.id,
      type: entry.type,
      label: entry.label,
      legs: entry.legs,
      x: resolveCoord(entry.x, "x", stage),
      y: resolveCoord(entry.y, "y", stage),
    };
    const group = makeComponentFromEntry(resolved);
    group.configId = entry.id;
    map[entry.id] = group;
  }

  return map;
}
