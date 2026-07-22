import { loadLabConfigFromPre } from "./lab-config.js";
import { bootCircuitLab } from "./app.js";
import { ensureCircuitLabStyles } from "./circuit-lab-styles.js";
import { applyCircuitLabSizeAttributes } from "./circuit-lab-size.js";

const MOUNTED_ATTR = "data-circuit-lab-mounted";

/**
 * Builds the toolbar + stage shell markup used inside the shadow root.
 */
function createLabUiShell() {
  const ui = document.createElement("div");
  ui.className = "circuit-lab-ui";
  ui.innerHTML =
    '<header class="lab-toolbar" data-lab-toolbar>' +
    '<h1 data-lab-title></h1>' +
    '<div class="toolbar-divider" aria-hidden="true"></div>' +
    '<div class="toolbar-group" role="group" aria-label="Lab mode">' +
    '<span class="toolbar-label">Mode</span>' +
    '<button type="button" class="toolbar-btn active" data-lab-mode="demo" aria-pressed="true">Demo</button>' +
    '<button type="button" class="toolbar-btn" data-lab-mode="lab" aria-pressed="false">Lab</button>' +
    "</div>" +
    '<div class="toolbar-divider" aria-hidden="true"></div>' +
    '<div class="toolbar-group" role="group" aria-label="Circuit actions">' +
    '<button type="button" class="toolbar-btn" data-lab-action="undo" disabled title="Undo (Ctrl/Cmd+Z)">Undo</button>' +
    '<button type="button" class="toolbar-btn lab-btn-test" data-lab-action="test">Test</button>' +
    '<button type="button" class="toolbar-btn lab-btn-check" data-lab-action="check" disabled>Check</button>' +
    "</div>" +
    '<div class="toolbar-divider" aria-hidden="true"></div>' +
    '<div class="toolbar-group toolbar-zoom" data-lab-zoom role="group" aria-label="Zoom controls">' +
    '<button type="button" class="toolbar-btn" data-lab-zoom="out" aria-label="Zoom out" title="Zoom out">−</button>' +
    '<span class="toolbar-zoom-label" data-lab-zoom-label>100%</span>' +
    '<button type="button" class="toolbar-btn" data-lab-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>' +
    '<button type="button" class="toolbar-btn" data-lab-zoom="reset" title="Reset view">Reset view</button>' +
    "</div>" +
    '<p class="lab-hint" data-lab-hint></p>' +
    "</header>" +
    '<div class="lab-stage-wrap" data-lab-stage-wrap>' +
    '<div class="lab-stage" data-lab-stage></div>' +
    "</div>";
  return ui;
}

/**
 * Creates a sized host div that will replace a pre.circuit-lab block.
 * @param {HTMLElement} pre - Source pre element (may carry width/height attributes).
 */
function createHostFromPre(pre) {
  const host = document.createElement("div");
  host.className = "circuit-lab";
  host.setAttribute(MOUNTED_ATTR, "");
  const width = pre.getAttribute("width");
  const height = pre.getAttribute("height");
  if (width != null) {
    host.setAttribute("width", width);
  }
  if (height != null) {
    host.setAttribute("height", height);
  }
  applyCircuitLabSizeAttributes(host);
  return host;
}

/**
 * Shows a config error inside a shadow root.
 * @param {ShadowRoot} shadow - Open shadow root on the host.
 * @param {unknown} err - Error thrown while loading or normalizing config.
 */
function showConfigError(shadow, err) {
  shadow.replaceChildren();
  ensureCircuitLabStyles(shadow);
  const error = document.createElement("p");
  error.className = "circuit-lab-error";
  error.textContent =
    "circuit-lab config error: " + (err && err.message ? err.message : err);
  shadow.appendChild(error);
}

/**
 * Replaces a pre.circuit-lab block with a shadow-DOM host and boots the Konva lab.
 * @param {HTMLElement} pre - The pre.circuit-lab element containing inline YAML.
 */
export function mountCircuitLab(pre) {
  if (!(pre instanceof HTMLElement) || pre.getAttribute(MOUNTED_ATTR) != null) {
    return null;
  }

  let config;
  try {
    config = loadLabConfigFromPre(pre);
  } catch (err) {
    const host = createHostFromPre(pre);
    pre.replaceWith(host);
    const shadow = host.attachShadow({ mode: "open" });
    showConfigError(shadow, err);
    return host;
  }

  const host = createHostFromPre(pre);
  pre.replaceWith(host);

  const shadow = host.attachShadow({ mode: "open" });
  ensureCircuitLabStyles(shadow);
  shadow.appendChild(createLabUiShell());
  bootCircuitLab(host, config);
  return host;
}

/**
 * Finds all pre.circuit-lab blocks under root and mounts each as an interactive lab.
 * @param {ParentNode} [root] - Document or element to search; defaults to document.
 */
export function scanAndMountLabs(root) {
  const scope = root || document;
  if (!scope || !scope.querySelectorAll) {
    return [];
  }
  const blocks = scope.querySelectorAll("pre.circuit-lab");
  const hosts = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const host = mountCircuitLab(blocks[i]);
    if (host) {
      hosts.push(host);
    }
  }
  return hosts;
}

if (typeof document !== "undefined") {
  scanAndMountLabs();
}
