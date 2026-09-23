import Konva from "konva";
import { TERMINAL_OUTSET } from "./components/shared.js";

/** @type {{ shape: Konva.Shape, anim: Konva.Animation }|null} */
let activePulse = null;

/**
 * Cancels and destroys any in-flight hint outline pulse.
 */
function clearActivePulse() {
  if (!activePulse) {
    return;
  }
  activePulse.anim.stop();
  activePulse.shape.destroy();
  activePulse = null;
}

/**
 * Runs a short opacity/stroke pulse on a shape, then destroys it.
 * @param {Konva.Shape} shape - Outline shape already added to a layer.
 * @param {Konva.Layer} layer - Layer to redraw.
 */
function runPulseAnimation(shape, layer) {
  const durationMs = 1400;
  const started = performance.now();
  const baseStroke = shape.strokeWidth() || 3;
  const anim = new Konva.Animation(function () {
    const elapsed = performance.now() - started;
    if (elapsed >= durationMs) {
      clearActivePulse();
      layer.batchDraw();
      return;
    }
    const t = elapsed / durationMs;
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * Math.PI * 2));
    const fade = 1 - t;
    shape.opacity(pulse * fade);
    shape.strokeWidth(baseStroke + 2 * pulse);
    shape.shadowBlur(8 + 10 * pulse);
  }, layer);

  activePulse = { shape: shape, anim: anim };
  anim.start();
  layer.batchDraw();
}

/**
 * Draws a brief pulsing amber ring around a terminal node.
 * @param {{ node?: Konva.Circle, radius?: number }|null|undefined} terminal - Terminal metadata from addTerminal.
 */
function pulseTerminalOutline(terminal) {
  if (!terminal || !terminal.node || typeof terminal.node.getLayer !== "function") {
    return;
  }
  const node = terminal.node;
  const layer = node.getLayer();
  if (!layer) {
    return;
  }

  const bounds = node.getClientRect({
    skipShadow: true,
    relativeTo: layer,
  });
  const pad = 10;
  const radius = Math.max(bounds.width, bounds.height) / 2 + pad;
  const circle = new Konva.Circle({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    radius: radius,
    stroke: "#f59e0b",
    strokeWidth: 3,
    shadowColor: "#f59e0b",
    shadowBlur: 12,
    shadowOpacity: 0.85,
    listening: false,
    name: "terminal-pulse-outline",
  });
  layer.add(circle);
  circle.moveToTop();
  runPulseAnimation(circle, layer);
}

/**
 * Draws a brief pulsing amber outline around a component group on its layer.
 * No-op when group is missing or has no layer. Replaces any prior pulse.
 * @param {Konva.Group|null|undefined} group - Component Konva group to outline.
 */
export function pulseComponentOutline(group) {
  clearActivePulse();
  if (!group || typeof group.getLayer !== "function") {
    return;
  }
  const layer = group.getLayer();
  if (!layer) {
    return;
  }

  const bounds = group.getClientRect({
    skipShadow: true,
    relativeTo: layer,
  });
  const pad = TERMINAL_OUTSET + 4;
  const rect = new Konva.Rect({
    x: bounds.x - pad,
    y: bounds.y - pad,
    width: bounds.width + pad * 2,
    height: bounds.height + pad * 2,
    stroke: "#f59e0b",
    strokeWidth: 3,
    cornerRadius: 6,
    shadowColor: "#f59e0b",
    shadowBlur: 12,
    shadowOpacity: 0.85,
    listening: false,
    name: "component-pulse-outline",
  });
  layer.add(rect);
  rect.moveToTop();
  runPulseAnimation(rect, layer);
}

/**
 * Pulses a specific terminal when provided; otherwise outlines the whole component.
 * @param {Konva.Group|null|undefined} group - Component group (used when no terminal).
 * @param {{ node?: Konva.Circle, radius?: number }|null|undefined} [terminal] - Optional terminal to highlight.
 */
export function pulseHintTarget(group, terminal) {
  clearActivePulse();
  if (terminal && terminal.node) {
    pulseTerminalOutline(terminal);
    return;
  }
  pulseComponentOutline(group);
}
