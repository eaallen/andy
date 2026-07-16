import { loadLabConfigFromElement } from "./lab-config.js";
import { bootCircuitLab } from "./app.js";
import { ensureCircuitLabStyles } from "./circuit-lab-styles.js";
import { applyCircuitLabSizeAttributes } from "./circuit-lab-size.js";

ensureCircuitLabStyles();

/**
 * Custom element that loads YAML (file or inline) and boots a Konva circuit lab.
 *
 * Usage (preferred — external file):
 *   <circuit-lab src="labs/doorbell.yaml" width="900" height="600"></circuit-lab>
 *
 * width / height accept CSS sizes (`600px`, `100%`, `70vh`) or bare numbers (pixels).
 * Omit them to fill the parent (default CSS is width/height 100%).
 *
 * Or inline:
 *   <circuit-lab>
 *     <script type="text/yaml">
 *     title: My Lab
 *     ...
 *     </script>
 *   </circuit-lab>
 */
class CircuitLabElement extends HTMLElement {
  /**
   * Attributes that resize the host when changed.
   */
  static get observedAttributes() {
    return ["width", "height"];
  }

  /**
   * Applies width/height from the HTML tag onto the host style.
   * @param {string} name - Changed attribute name.
   * @param {string | null} _oldValue - Previous attribute value.
   * @param {string | null} _newValue - New attribute value.
   */
  attributeChangedCallback(name, _oldValue, _newValue) {
    if (name !== "width" && name !== "height") {
      return;
    }
    applyCircuitLabSizeAttributes(this);
    if (this._booted) {
      window.dispatchEvent(new Event("resize"));
    }
  }

  /**
   * Builds toolbar + stage markup and starts the lab from YAML.
   */
  connectedCallback() {
    applyCircuitLabSizeAttributes(this);
    if (this._booted) {
      return;
    }
    this._booted = true;
    ensureCircuitLabStyles();
    this._boot();
  }

  /**
   * Loads config, renders the UI shell, and boots the Konva app.
   */
  async _boot() {
    let config;
    try {
      config = await loadLabConfigFromElement(this);
    } catch (err) {
      this.textContent =
        "circuit-lab config error: " + (err && err.message ? err.message : err);
      return;
    }

    this.replaceChildren();

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
      '<div class="toolbar-group" data-lab-wire-colors role="group" aria-label="Wire color">' +
      '<span class="toolbar-label">Wire</span>' +
      '<button type="button" class="wire-swatch wire-red active" data-color="red" aria-label="Red wire" aria-pressed="true"></button>' +
      '<button type="button" class="wire-swatch wire-gray" data-color="gray" aria-label="Gray wire" aria-pressed="false"></button>' +
      '<button type="button" class="wire-swatch wire-blue" data-color="blue" aria-label="Blue wire" aria-pressed="false"></button>' +
      '<button type="button" class="wire-swatch wire-green" data-color="green" aria-label="Green wire" aria-pressed="false"></button>' +
      "</div>" +
      '<div class="toolbar-divider" aria-hidden="true"></div>' +
      '<div class="toolbar-group" role="group" aria-label="Circuit actions">' +
      '<button type="button" class="toolbar-btn" data-lab-action="undo" disabled title="Undo (Ctrl/Cmd+Z)">Undo</button>' +
      '<button type="button" class="toolbar-btn lab-btn-test" data-lab-action="test">Test</button>' +
      '<button type="button" class="toolbar-btn lab-btn-check" data-lab-action="check" disabled>Check</button>' +
      "</div>" +
      '<p class="lab-hint" data-lab-hint></p>' +
      "</header>" +
      '<div class="lab-stage-wrap">' +
      '<div class="lab-stage" data-lab-stage></div>' +
      "</div>";

    this.appendChild(ui);
    bootCircuitLab(this, config);
  }
}

if (!customElements.get("circuit-lab")) {
  customElements.define("circuit-lab", CircuitLabElement);
}
