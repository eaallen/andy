/**
 * Component type identifiers used across lab layouts.
 */
export const COMPONENT_TYPES = {
  POWER: "power",
  TRANSFORMER: "transformer",
  CHIME: "chime",
  BUTTON: "button",
  SWITCH: "switch",
  THREE_WAY: "three-way",
  FOUR_WAY: "four-way",
  LAMP: "lamp",
  RECEPTACLE: "receptacle",
  GFCI: "gfci",
  TERMINAL_BLOCK: "terminalBlock",
};

/**
 * Terminal role identifiers for continuity tracing and grading.
 */
export const TERMINAL_ROLES = {
  L1: "l1",
  L2: "l2",
  NEUTRAL: "neutral",
  GROUND: "ground",
  HOT_24V: "hot24v",
  COM_24V: "com24v",
  CHIME_FRONT: "chimeFront",
  CHIME_TRANS: "chimeTrans",
  CHIME_REAR: "chimeRear",
  BTN_COMMON: "btnCommon",
  BTN_SIGNAL: "btnSignal",
  SWITCH_COM: "switchCom",
  SWITCH_NO: "switchNo",
  TRAVELER_1: "traveler1",
  TRAVELER_2: "traveler2",
  FOUR_WAY_A1: "fourWayA1",
  FOUR_WAY_A2: "fourWayA2",
  FOUR_WAY_B1: "fourWayB1",
  FOUR_WAY_B2: "fourWayB2",
  LOAD_HOT: "loadHot",
  LOAD_NEUTRAL: "loadNeutral",
  LINE_HOT: "lineHot",
  LINE_NEUTRAL: "lineNeutral",
  LINE_GROUND: "lineGround",
  LOAD_SIDE_HOT: "loadSideHot",
  LOAD_SIDE_NEUTRAL: "loadSideNeutral",
  LOAD_SIDE_GROUND: "loadSideGround",
  JUNCTION: "junction",
};

export const WIRE_COLORS = {
  black: "#0f172a",
  white: "#ffffff",
  red: "#dc2626",
  blue: "#2563eb",
  yellow: "#eab308",
  orange: "#ea580c",
  green: "#16a34a",
  purple: "#9333ea",
  /** Legacy alias used by component terminals and YAML demo wires. */
  gray: "#71717a",
};

/** Default color for newly drawn wires. */
export const DEFAULT_WIRE_COLOR = "black";

/** Ordered wire color options for the floating picker (matches React lab). */
export const WIRE_COLOR_OPTIONS = [
  { id: "black", label: "Black", hex: WIRE_COLORS.black },
  { id: "white", label: "White", hex: WIRE_COLORS.white },
  { id: "red", label: "Red", hex: WIRE_COLORS.red },
  { id: "blue", label: "Blue", hex: WIRE_COLORS.blue },
  { id: "yellow", label: "Yellow", hex: WIRE_COLORS.yellow },
  { id: "orange", label: "Orange", hex: WIRE_COLORS.orange },
  { id: "green", label: "Green", hex: WIRE_COLORS.green },
  { id: "purple", label: "Purple", hex: WIRE_COLORS.purple },
];
