import {
  ENERGIZE_CURRENT_THRESHOLD,
  SHORT_AMP_CAP,
} from "./electrical.js";

/**
 * Formats a voltage for canvas / HUD display.
 * @param {number} volts - Voltage in volts.
 */
export function formatVolts(volts) {
  if (typeof volts !== "number" || !Number.isFinite(volts)) {
    return "—";
  }
  const abs = Math.abs(volts);
  if (abs < 0.05) {
    return "0 V";
  }
  if (abs >= 100) {
    return Math.round(volts) + " V";
  }
  const rounded = Math.round(volts * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + " V";
}

/**
 * Formats a current for canvas / HUD display (caps extreme shorts).
 * Shows magnitude only — signed branch current is a solver convention
 * (wire from→to and split-phase −V), not something students should read.
 * @param {number} amps - Current in amperes (sign ignored).
 * @param {boolean} [short] - Whether the network is in a shorted state.
 */
export function formatAmps(amps, short) {
  if (typeof amps !== "number" || !Number.isFinite(amps)) {
    return "—";
  }
  const abs = Math.abs(amps);
  if (short || abs > SHORT_AMP_CAP) {
    return ">50 A";
  }
  if (abs < 0.0005) {
    return "0 A";
  }
  if (abs >= 10) {
    return (Math.round(abs * 10) / 10) + " A";
  }
  return (Math.round(abs * 100) / 100).toFixed(2) + " A";
}

/**
 * Formats a power value for canvas / HUD display.
 * @param {number} watts - Power in watts.
 */
export function formatWatts(watts) {
  if (typeof watts !== "number" || !Number.isFinite(watts)) {
    return "—";
  }
  const abs = Math.abs(watts);
  if (abs < 0.05) {
    return "0 W";
  }
  if (abs >= 100) {
    return Math.round(watts) + " W";
  }
  if (abs >= 10) {
    return (Math.round(watts * 10) / 10) + " W";
  }
  return (Math.round(watts * 100) / 100).toFixed(2) + " W";
}

/**
 * Formats a resistance for canvas / HUD display.
 * @param {number} ohms - Resistance in ohms.
 */
export function formatOhms(ohms) {
  if (typeof ohms !== "number" || !Number.isFinite(ohms) || ohms < 0) {
    return "—";
  }
  if (ohms >= 1000) {
    const k = ohms / 1000;
    return (Number.isInteger(k) ? String(k) : Math.round(k * 10) / 10) + " kΩ";
  }
  if (Number.isInteger(ohms) || Math.abs(ohms - Math.round(ohms)) < 0.05) {
    return Math.round(ohms) + " Ω";
  }
  return (Math.round(ohms * 10) / 10) + " Ω";
}

/**
 * Builds a stacked display string for a wire (amps above volts).
 * @param {{ amps?: number, volts?: number, short?: boolean }} values - Wire measurements.
 */
export function formatWireMeasurement(values) {
  const parts = [];
  if (values && typeof values.amps === "number") {
    parts.push(formatAmps(values.amps, !!(values && values.short)));
  }
  if (values && typeof values.volts === "number") {
    parts.push(formatVolts(values.volts));
  }
  return parts.join("\n");
}

/**
 * Builds a short display string for a load's R / V / I / P tuple.
 * @param {{ ohms?: number|null, volts?: number, amps?: number, short?: boolean }} values - Measurement parts.
 */
export function formatLoadMeasurement(values) {
  const parts = [];
  if (values && typeof values.ohms === "number" && values.ohms > 0) {
    parts.push(formatOhms(values.ohms));
  }
  if (values && typeof values.volts === "number") {
    parts.push(formatVolts(Math.abs(values.volts)));
  }
  if (values && typeof values.amps === "number") {
    parts.push(formatAmps(values.amps, !!(values && values.short)));
  }
  if (
    values &&
    typeof values.volts === "number" &&
    typeof values.amps === "number" &&
    Math.abs(values.amps) > ENERGIZE_CURRENT_THRESHOLD
  ) {
    parts.push(formatWatts(Math.abs(values.volts * values.amps)));
  }
  return parts.join(" · ");
}
