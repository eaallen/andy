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
  position: relative;
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

.lab-hint-ref {
  display: inline-block;
  vertical-align: baseline;
  margin: 0 1px;
  padding: 1px 7px;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  background: #fef2f2;
  box-shadow: 0 1px 0 rgba(185, 28, 28, 0.12);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  color: #991b1b;
  text-decoration: none;
  cursor: pointer;
}

.lab-hint-ref:hover {
  background: #fee2e2;
  border-color: #f87171;
  color: #7f1d1d;
}

.lab-hint-ref:active {
  background: #fecaca;
  box-shadow: none;
  transform: translateY(1px);
}

.lab-hint-ref:focus-visible {
  outline: 2px solid #ef4444;
  outline-offset: 1px;
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
  cursor: default;
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

/* Decorative brand mark — fixed to the viewport, never captures input. */
.lab-stage-wrap::before {
  content: "AndyLabs";
  position: absolute;
  inset: 0;
  z-index: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  user-select: none;
  font-family: "Avenir Next", "Century Gothic", Futura, "Trebuchet MS",
    sans-serif;
  font-size: clamp(2.75rem, 11vw, 6.5rem);
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  white-space: nowrap;
  color: rgba(63, 63, 70, 0.1);
  -webkit-text-stroke: 1px rgba(63, 63, 70, 0.12);
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.45),
    0 12px 28px rgba(24, 24, 27, 0.05);
  transform: rotate(-18deg);
}

.lab-stage {
  position: relative;
  z-index: 1;
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

.lab-messages-panel {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(22rem, calc(100% - 24px));
  max-height: 40%;
  padding: 10px 12px;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  background: #ffffff;
  box-shadow:
    0 8px 24px rgba(24, 24, 27, 0.16),
    0 1px 3px rgba(24, 24, 27, 0.08);
  pointer-events: auto;
}

.lab-messages-panel[hidden] {
  display: none;
}

.lab-messages-panel--success {
  border-color: #86efac;
  background: #f0fdf4;
}

.lab-messages-panel--failure {
  border-color: #fca5a5;
  background: #fef2f2;
}

.lab-messages-panel--info {
  border-color: #d4d4d8;
  background: #ffffff;
}

.lab-messages-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.lab-messages-header.is-dragging {
  cursor: grabbing;
}

.lab-messages-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  color: #18181b;
}

.lab-messages-panel--success .lab-messages-title {
  color: #15803d;
}

.lab-messages-panel--failure .lab-messages-title {
  color: #b91c1c;
}

.lab-messages-panel--minimized {
  max-height: none;
  gap: 0;
}

.lab-messages-panel--minimized .lab-messages-body {
  display: none;
}

.lab-messages-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  margin: -4px -6px -4px 0;
}

.lab-messages-minimize,
.lab-messages-dismiss {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  border: 0;
  border-radius: 6px;
  padding: 0;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  touch-action: manipulation;
}

.lab-messages-minimize:hover,
.lab-messages-dismiss:hover {
  background: rgba(24, 24, 27, 0.06);
  color: #3f3f46;
}

.lab-messages-minimize:focus-visible,
.lab-messages-dismiss:focus-visible {
  outline: 2px solid #71717a;
  outline-offset: 1px;
}

.lab-messages-body {
  overflow: auto;
  min-height: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #3f3f46;
}

.lab-messages-body:empty {
  display: none;
}

.lab-messages-list {
  margin: 0;
  padding: 0 0 0 1.15rem;
}

.lab-messages-list > li + li {
  margin-top: 0.45rem;
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
