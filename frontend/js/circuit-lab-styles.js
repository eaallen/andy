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

.wire-menu {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 4px;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  background: #ffffff;
  box-shadow:
    0 4px 14px rgba(24, 24, 27, 0.14),
    0 1px 3px rgba(24, 24, 27, 0.08);
  pointer-events: auto;
}

.wire-menu[hidden] {
  display: none;
}

.wire-menu-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.wire-menu-item {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  padding: 0;
  background: transparent;
  color: #3f3f46;
  cursor: pointer;
}

.wire-menu-item:hover {
  background: #f4f4f5;
}

.wire-menu-item--danger {
  color: #dc2626;
}

.wire-menu-item--danger:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.wire-menu-color-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  padding: 0 6px;
  background: transparent;
  color: #71717a;
  cursor: pointer;
}

.wire-menu-color-trigger:hover {
  background: #f4f4f5;
}

.wire-menu-color-trigger[aria-expanded="true"] {
  background: #f4f4f5;
}

.wire-menu-color-trigger[aria-expanded="true"] svg {
  transform: rotate(180deg);
}

.wire-menu-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 2px;
}

.wire-menu-swatch {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(24, 24, 27, 0.2);
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

button.wire-menu-swatch:hover {
  outline: 2px solid #a1a1aa;
  outline-offset: 1px;
}

.wire-menu-swatch--selected {
  outline: 2px solid #18181b;
  outline-offset: 1px;
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
