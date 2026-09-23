import Konva from "konva";
import { getTerminalPosition } from "./components/shared.js";
import {
  ENERGIZE_CURRENT_THRESHOLD,
  ENERGIZE_VOLTAGE_THRESHOLD,
} from "./electrical.js";
import {
  formatLoadMeasurement,
  formatWireMeasurement,
} from "./circuit-format.js";

/** Font size in screen pixels for overlay (wire) labels. */
const LABEL_SCREEN_PX = 11;
/** Distance (world px at scale 1) to sit current labels beside a wire. */
const WIRE_LABEL_OFFSET = 14;

/**
 * Halfway point along a polyline plus a unit normal (CCW from the tangent).
 * @param {number[]} pts - Flat point list from Konva.Line.points().
 */
export function pointAndNormalAlongPoints(pts) {
  if (!pts || pts.length < 4) {
    return null;
  }
  let total = 0;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const dx = pts[i + 2] - pts[i];
    const dy = pts[i + 3] - pts[i + 1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  if (total <= 0) {
    return { x: pts[0], y: pts[1], nx: 0, ny: -1 };
  }
  let walked = 0;
  const half = total / 2;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const dx = pts[i + 2] - pts[i];
    const dy = pts[i + 3] - pts[i + 1];
    const seg = Math.sqrt(dx * dx + dy * dy);
    if (walked + seg >= half) {
      const t = seg > 0 ? (half - walked) / seg : 0;
      const x = pts[i] + dx * t;
      const y = pts[i + 1] + dy * t;
      const inv = seg > 0 ? 1 / seg : 0;
      return { x: x, y: y, nx: -dy * inv, ny: dx * inv };
    }
    walked += seg;
  }
  return {
    x: pts[pts.length - 2],
    y: pts[pts.length - 1],
    nx: 0,
    ny: -1,
  };
}

/**
 * Offset a wire-current label so it sits beside the stroke, not on it.
 * @param {{ x: number, y: number, nx?: number, ny?: number }} along - Midpoint and optional normal.
 * @param {number} distance - Offset in world pixels.
 */
export function offsetBesideWire(along, distance) {
  if (!along) {
    return { x: 0, y: 0 };
  }
  const nx = along.nx || 0;
  const ny = along.ny || 0;
  const mag = Math.sqrt(nx * nx + ny * ny);
  if (mag < 1e-6) {
    return { x: along.x, y: along.y - distance };
  }
  // Prefer the side that sits "above" the wire in screen space so labels stay consistent.
  const sign = ny < 0 || (ny === 0 && nx < 0) ? 1 : -1;
  const s = (sign * distance) / mag;
  return { x: along.x + nx * s, y: along.y + ny * s };
}

/**
 * Creates a Konva overlay that draws live measurements.
 * Load V/I/P live on each component's own readout slot; wire current sits beside the stroke.
 * @param {Konva.Layer} layer - Layer to draw wire-current text on (above wires).
 * @param {() => { scale: number }} getView - Returns the current camera view.
 * @param {() => object[]} getWires - Returns the live wire list.
 * @param {() => object} getComponents - Returns config id → component group.
 * @param {(terminal: object) => string} terminalKey - Stable terminal key fn from simulator.
 */
export function createMeasurementsOverlay(
  layer,
  getView,
  getWires,
  getComponents,
  terminalKey
) {
  let enabled = true;
  /** @type {Konva.Group|null} */
  let root = null;
  /** @type {object|null} */
  let lastResult = null;
  /** @type {object|null} */
  let lastSimulation = null;

  /**
   * Ensures the overlay group exists on the layer.
   */
  function ensureRoot() {
    if (root) {
      return root;
    }
    root = new Konva.Group({ name: "measurements-overlay", listening: false });
    layer.add(root);
    return root;
  }

  /**
   * Screen-constant font size under the current camera zoom.
   */
  function fontSize() {
    const view = typeof getView === "function" ? getView() : null;
    const scale = view && view.scale > 0 ? view.scale : 1;
    return LABEL_SCREEN_PX / scale;
  }

  /**
   * Clears overlay labels (does not touch in-component readouts).
   */
  function clearOverlay() {
    if (root) {
      root.destroyChildren();
      layer.batchDraw();
    }
  }

  /**
   * Hides every component-owned readout.
   */
  function hideComponentReadouts() {
    const components = getComponents() || {};
    const ids = Object.keys(components);
    for (let i = 0; i < ids.length; i += 1) {
      const readout = components[ids[i]] && components[ids[i]].measurementReadout;
      if (readout) {
        readout.text("");
        readout.visible(false);
      }
    }
  }

  /**
   * Midpoint + normal of a wire in layer space.
   * @param {object} wire - Wire record with from/to terminals and optional line.
   */
  function wireAlong(wire) {
    if (wire && wire.line && typeof wire.line.points === "function") {
      const along = pointAndNormalAlongPoints(wire.line.points());
      if (along) {
        return along;
      }
    }
    const a = getTerminalPosition(wire.from, layer);
    const b = getTerminalPosition(wire.to, layer);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      nx: mag > 0 ? -dy / mag : 0,
      ny: mag > 0 ? dx / mag : -1,
    };
  }

  /**
   * Adds a wire measurement chip: stacked A / V lines on a translucent pill.
   * @param {Konva.Group} parent - Overlay root.
   * @param {number} x - World anchor x (chip center).
   * @param {number} y - World anchor y (chip center).
   * @param {string} text - Multiline label text (amps\\nvolts).
   */
  function addWireChip(parent, x, y, text) {
    if (!text) {
      return;
    }
    const size = fontSize();
    const padX = size * 0.45;
    const padY = size * 0.25;
    const label = new Konva.Text({
      x: 0,
      y: 0,
      text: text,
      fontSize: size,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontStyle: "bold",
      fill: "#9a3412",
      align: "center",
      lineHeight: 1.15,
      listening: false,
    });
    const width = label.width() + padX * 2;
    const height = label.height() + padY * 2;
    label.x(padX);
    label.y(padY);

    const chip = new Konva.Group({
      x: x,
      y: y,
      offsetX: width / 2,
      offsetY: height / 2,
      listening: false,
      name: "wire-measurement-chip",
    });
    chip.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: "rgba(255, 247, 237, 0.88)",
        stroke: "rgba(234, 88, 12, 0.45)",
        strokeWidth: Math.max(0.75, size * 0.08),
        cornerRadius: size * 0.35,
        listening: false,
      })
    );
    chip.add(label);
    parent.add(chip);
  }

  /**
   * Fills in-component readout slots from the last simulate() result.
   * @param {object} result - Simulate output.
   * @param {object|null} simulation - Normalized simulation config.
   */
  function fillComponentReadouts(result, simulation) {
    const components = getComponents() || {};
    const ids = Object.keys(components);
    /** @type {{ [configId: string]: object[] }} */
    const loadsByComponent = {};
    const loads =
      simulation && Array.isArray(simulation.loads) ? simulation.loads : [];
    for (let L = 0; L < loads.length; L += 1) {
      const load = loads[L];
      const configId = load.requireHot && load.requireHot.component;
      if (!configId) {
        continue;
      }
      if (!loadsByComponent[configId]) {
        loadsByComponent[configId] = [];
      }
      loadsByComponent[configId].push(load);
    }

    for (let i = 0; i < ids.length; i += 1) {
      const configId = ids[i];
      const component = components[configId];
      const readout = component && component.measurementReadout;
      if (!readout) {
        continue;
      }
      const componentLoads = loadsByComponent[configId] || [];
      /** @type {string[]} */
      const lines = [];
      for (let L = 0; L < componentLoads.length; L += 1) {
        const load = componentLoads[L];
        // Component may already show ohms on the body (e.g. resistor zigzag label).
        const ohms = component.measurementOmitsOhms ? null : load.ohms;
        const drop = result.loadVoltages && result.loadVoltages[load.id];
        const amps = result.loadCurrents && result.loadCurrents[load.id];
        const prefix =
          componentLoads.length > 1 && load.id ? load.id + " " : "";
        const text = formatLoadMeasurement({
          ohms: ohms,
          volts: drop,
          amps: amps,
          short: result.short,
        });
        if (text) {
          lines.push(prefix + text);
        }
      }
      const joined = lines.join("\n");
      readout.text(joined);
      readout.visible(!!joined);
    }
  }

  /**
   * Rebuilds labels from a simulate() result (and caches it for syncLayout).
   * @param {object|null} result - Output from createCircuitSimulator.simulate.
   * @param {object|null} simulation - Normalized simulation config (for load ohms).
   */
  function update(result, simulation) {
    lastResult = result || null;
    lastSimulation = simulation || null;
    redraw();
  }

  /**
   * Repositions overlay labels after drag / pan / bend. Component slots move with the group.
   */
  function syncLayout() {
    redrawOverlay();
  }

  /**
   * Draws wire-current labels and refreshes in-component readouts.
   */
  function redraw() {
    if (!enabled) {
      hideComponentReadouts();
      clearOverlay();
      return;
    }
    const result = lastResult;
    if (result) {
      fillComponentReadouts(result, lastSimulation);
    } else {
      hideComponentReadouts();
    }
    redrawOverlay();
  }

  /**
   * Draws wire-current labels beside each live conductor.
   */
  function redrawOverlay() {
    if (!enabled) {
      clearOverlay();
      return;
    }
    const group = ensureRoot();
    group.destroyChildren();
    const result = lastResult;
    if (!result) {
      layer.batchDraw();
      return;
    }

    const view = typeof getView === "function" ? getView() : null;
    const scale = view && view.scale > 0 ? view.scale : 1;
    const offset = WIRE_LABEL_OFFSET / scale;
    const wireCurrents = result.wireCurrents || [];
    const voltages = result.voltages || {};
    const short = !!result.short;
    const wires = getWires() || [];
    for (let w = 0; w < wires.length; w += 1) {
      const wire = wires[w];
      const amps = wireCurrents[w];
      const va =
        wire && wire.from && typeof terminalKey === "function"
          ? voltages[terminalKey(wire.from)]
          : undefined;
      const vb =
        wire && wire.to && typeof terminalKey === "function"
          ? voltages[terminalKey(wire.to)]
          : undefined;
      const hasAmps = typeof amps === "number";
      const hasVolts = typeof va === "number" || typeof vb === "number";
      if (!hasAmps && !hasVolts) {
        continue;
      }
      const liveAmps =
        hasAmps && (short || Math.abs(amps) > ENERGIZE_CURRENT_THRESHOLD);
      let potential = null;
      if (typeof va === "number" && typeof vb === "number") {
        potential = (va + vb) / 2;
      } else if (typeof va === "number") {
        potential = va;
      } else if (typeof vb === "number") {
        potential = vb;
      }
      const liveVolts =
        typeof potential === "number" &&
        Math.abs(potential) > ENERGIZE_VOLTAGE_THRESHOLD;
      if (!liveAmps && !liveVolts) {
        continue;
      }
      const text = formatWireMeasurement({
        amps: hasAmps ? amps : 0,
        volts: typeof potential === "number" ? potential : undefined,
        short: short,
      });
      if (!text) {
        continue;
      }
      const beside = offsetBesideWire(wireAlong(wire), offset);
      addWireChip(group, beside.x, beside.y, text);
    }

    group.moveToTop();
    layer.batchDraw();
  }

  /**
   * Enables or disables the measurements overlay.
   * @param {boolean} on - Whether labels should show.
   */
  function setEnabled(on) {
    enabled = !!on;
    redraw();
  }

  /**
   * Returns whether the overlay is currently enabled.
   */
  function isEnabled() {
    return enabled;
  }

  /**
   * Clears overlay and hides component readouts.
   */
  function clear() {
    hideComponentReadouts();
    clearOverlay();
  }

  return {
    update: update,
    syncLayout: syncLayout,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    clear: clear,
  };
}
