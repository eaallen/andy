/** Default resistance of student wires and closed switch bridges (ohms). */
export const WIRE_OHMS = 0.01;

/** Branch current above this is treated as a short for display. */
export const SHORT_AMP_CAP = 50;

/** Default RMS supply voltage when YAML omits supply.volts. */
export const DEFAULT_SUPPLY_VOLTS = 120;

/** Default lamp resistance (~100 W at 120 V). */
export const DEFAULT_LAMP_OHMS = 144;

/** Default chime-coil resistance. */
export const DEFAULT_CHIME_OHMS = 24;

/** Default resistor component resistance. */
export const DEFAULT_RESISTOR_OHMS = 100;

/** Current (A) above which a conductive load counts as energized. */
export const ENERGIZE_CURRENT_THRESHOLD = 1e-4;

/** Voltage drop (V) above which an open-circuit probe load counts as live. */
export const ENERGIZE_VOLTAGE_THRESHOLD = 1;

/**
 * Default load resistance for a component type, or null for open-circuit probes.
 * @param {string} componentType - COMPONENT_TYPES value or YAML type string.
 */
export function defaultOhmsForComponentType(componentType) {
  if (componentType === "lamp") {
    return DEFAULT_LAMP_OHMS;
  }
  if (componentType === "chime") {
    return DEFAULT_CHIME_OHMS;
  }
  if (componentType === "resistor") {
    return DEFAULT_RESISTOR_OHMS;
  }
  // receptacle, gfci, and unknown types are voltage probes (open circuit).
  return null;
}
