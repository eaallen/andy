const STYLE_ATTR = "data-circuit-lab-styles";
const DOCUMENT_UI_STYLE_ID = "circuit-lab-styles";

/**
 * CSS for the circuit-lab shadow tree (toolbar, stage, wire swatches).
 * Kept as a JS string so library consumers only need the bundled JS file.
 */
export const CIRCUIT_LAB_CSS = `
:host {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #1a1a1a;
  background: #fafafa;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.circuit-lab-ui {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font: inherit;
  color: inherit;
}

.lab-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #d4d4d8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.lab-toolbar h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  color: inherit;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #e4e4e7;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 6px 12px;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  background: #fff;
  color: #1a1a1a;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.toolbar-btn:hover {
  background: #f4f4f5;
  border-color: #a1a1aa;
}

.toolbar-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.toolbar-btn.active:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lab-btn-test {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
  font-weight: 600;
}

.lab-btn-test:hover:not(:disabled) {
  background: #15803d;
  border-color: #15803d;
}

.lab-btn-check {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
  font-weight: 600;
}

.lab-btn-check:hover:not(:disabled) {
  background: #6d28d9;
  border-color: #6d28d9;
}

.wire-swatch {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid #d4d4d8;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
}

.wire-swatch:hover {
  transform: scale(1.08);
  border-color: #a1a1aa;
}

.wire-swatch.active {
  border-color: #1a1a1a;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #2563eb;
}

.wire-red {
  background: #dc2626;
}

.wire-gray {
  background: #71717a;
}

.wire-blue {
  background: #2563eb;
}

.wire-green {
  background: #16a34a;
}

.lab-hint {
  flex: 1 1 220px;
  margin: 0;
  font-size: 12px;
  color: #71717a;
  line-height: 1.4;
  min-width: 0;
}

.lab-hint.pass {
  color: #15803d;
  font-weight: 600;
}

.lab-hint.fail {
  color: #b91c1c;
  font-weight: 600;
}

.toolbar-zoom-label {
  min-width: 3.25rem;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #52525b;
}

.lab-stage-wrap {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  /* Let Konva own touch pans/zooms instead of the browser scrolling the page. */
  touch-action: none;
  overscroll-behavior: none;
  /* FigJam-style soft canvas with a subtle dotted grid. */
  background-color: #e8e8e8;
  background-image: radial-gradient(
    circle,
    rgba(0, 0, 0, 0.14) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}

.lab-stage-wrap--panning {
  cursor: grabbing;
}

.lab-stage {
  width: 100%;
  height: 100%;
}

.lab-stage canvas {
  touch-action: none;
}

.circuit-lab-error {
  margin: 0;
  padding: 16px;
  font: inherit;
  color: #b91c1c;
}
`.trim();

/**
 * Injects circuit-lab UI styles into a shadow root (or document for tests).
 * @param {ShadowRoot | Document | null | undefined} [root] - Shadow root or document; defaults to document.
 */
export function ensureCircuitLabStyles(root) {
  if (typeof document === "undefined") {
    return;
  }

  const target = root || document;
  if (target instanceof ShadowRoot) {
    if (target.querySelector("style[" + STYLE_ATTR + "]")) {
      return;
    }
    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "");
    style.textContent = CIRCUIT_LAB_CSS;
    target.appendChild(style);
    return;
  }

  if (document.getElementById(DOCUMENT_UI_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = DOCUMENT_UI_STYLE_ID;
  style.setAttribute(STYLE_ATTR, "");
  style.textContent = CIRCUIT_LAB_CSS;
  document.head.appendChild(style);
}
