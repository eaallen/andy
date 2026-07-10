/* global jsyaml */

/**
 * Reads and normalizes a circuit-lab YAML definition into a runtime config.
 */

/**
 * Finds the first YAML script child inside a host element.
 * @param {HTMLElement} host - Custom element or container that holds the YAML.
 */
function findYamlScript(host) {
  const scripts = host.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i += 1) {
    const type = (scripts[i].getAttribute("type") || "").toLowerCase();
    if (type === "text/yaml" || type === "application/yaml" || type === "text/x-yaml") {
      return scripts[i];
    }
  }
  return null;
}

/**
 * Parses a YAML string into a plain object.
 * @param {string} source - Raw YAML text.
 */
function parseLabYaml(source) {
  if (typeof jsyaml === "undefined" || !jsyaml.load) {
    throw new Error("js-yaml is required to parse circuit-lab YAML.");
  }
  const data = jsyaml.load(source);
  if (!data || typeof data !== "object") {
    throw new Error("Circuit lab YAML must define an object.");
  }
  return data;
}

/**
 * Resolves a layout coordinate from a number or short expression.
 * Supports: 40, "40", "42%", "margin", "center", "center-140",
 * "right-190", "bottom-128", "left", "top".
 * @param {number|string} value - Coordinate expression.
 * @param {"x"|"y"} axis - Which stage axis to resolve against.
 * @param {{ width: number, height: number, margin: number }} stage - Stage metrics.
 */
function resolveCoord(value, axis, stage) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value == null ? 0 : value).trim();
  if (raw === "") {
    return 0;
  }

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1));
    if (!Number.isFinite(pct)) {
      return 0;
    }
    return axis === "x" ? (stage.width * pct) / 100 : (stage.height * pct) / 100;
  }

  const size = axis === "x" ? stage.width : stage.height;
  const margin = stage.margin;

  /**
   * Applies an optional +/- offset to a base value.
   * @param {number} base - Starting coordinate.
   * @param {string} rest - Remaining "+N" / "-N" text (may be empty).
   */
  function withOffset(base, rest) {
    if (!rest) {
      return base;
    }
    const match = rest.match(/^([+-]\d+(?:\.\d+)?)$/);
    if (!match) {
      return base;
    }
    return base + Number(match[1]);
  }

  if (raw === "margin" || raw.indexOf("margin") === 0) {
    return withOffset(margin, raw.slice("margin".length));
  }
  if (raw === "left" || raw.indexOf("left") === 0) {
    return withOffset(margin, raw.slice("left".length));
  }
  if (raw === "top" || raw.indexOf("top") === 0) {
    return withOffset(margin, raw.slice("top".length));
  }
  if (raw === "center" || raw.indexOf("center") === 0) {
    return withOffset(size / 2, raw.slice("center".length));
  }
  if (raw === "right" || raw.indexOf("right") === 0) {
    return withOffset(size, raw.slice("right".length));
  }
  if (raw === "bottom" || raw.indexOf("bottom") === 0) {
    return withOffset(size, raw.slice("bottom".length));
  }

  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parses a "componentId.terminalId" endpoint string.
 * @param {string} endpoint - Wire endpoint like "power.l1".
 */
function parseWireEndpoint(endpoint) {
  const text = String(endpoint || "");
  const sep = text.lastIndexOf(".");
  if (sep <= 0 || sep === text.length - 1) {
    throw new Error('Wire endpoint must look like "component.terminal", got: ' + text);
  }
  return {
    component: text.slice(0, sep),
    terminal: text.slice(sep + 1),
  };
}

/**
 * Normalizes a demo wire entry from YAML into { from, to, color }.
 * @param {object|Array} entry - YAML wire row.
 */
function normalizeWire(entry) {
  if (Array.isArray(entry)) {
    if (entry.length < 2) {
      throw new Error("Wire arrays need at least [from, to].");
    }
    return {
      from: parseWireEndpoint(entry[0]),
      to: parseWireEndpoint(entry[1]),
      color: entry[2] || "red",
    };
  }

  if (!entry || typeof entry !== "object") {
    throw new Error("Each demo wire must be an object or [from, to, color] array.");
  }

  return {
    from: parseWireEndpoint(entry.from),
    to: parseWireEndpoint(entry.to),
    color: entry.color || "red",
  };
}

/**
 * Normalizes a component entry from YAML.
 * @param {object} entry - YAML component row.
 * @param {number} index - Row index for error messages.
 */
function normalizeComponent(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error("components[" + index + "] must be an object.");
  }
  if (!entry.id) {
    throw new Error("components[" + index + "] needs an id.");
  }
  if (!entry.type) {
    throw new Error('Component "' + entry.id + '" needs a type.');
  }

  return {
    id: String(entry.id),
    type: String(entry.type),
    label: entry.label != null ? String(entry.label) : undefined,
    x: entry.x,
    y: entry.y,
  };
}

/**
 * Builds the runtime lab config used by the Konva app.
 * @param {object} raw - Parsed YAML object.
 */
function normalizeLabConfig(raw) {
  const margin = typeof raw.margin === "number" ? raw.margin : 40;
  const components = Array.isArray(raw.components) ? raw.components : [];
  const demo = raw.demo && typeof raw.demo === "object" ? raw.demo : {};
  const hints = raw.hints && typeof raw.hints === "object" ? raw.hints : {};
  const wires = Array.isArray(demo.wires) ? demo.wires.map(normalizeWire) : [];

  return {
    title: raw.title ? String(raw.title) : "Circuit Lab",
    margin: margin,
    hints: {
      demo: hints.demo ? String(hints.demo) : "",
      lab: hints.lab ? String(hints.lab) : "",
    },
    components: components.map(normalizeComponent),
    demoWires: wires,
    passMessage: raw.passMessage
      ? String(raw.passMessage)
      : "Pass — circuit matches the expected wiring.",
  };
}

/**
 * Fetches and normalizes lab config from a YAML URL.
 * @param {string} url - Path to a .yaml / .yml file.
 */
async function loadLabConfigFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load lab YAML from " + url + " (" + response.status + ").");
  }
  return normalizeLabConfig(parseLabYaml(await response.text()));
}

/**
 * Loads lab config from a host element's src attribute or inline YAML script.
 * Prefers src="labs/foo.yaml"; falls back to a <script type="text/yaml"> child.
 * @param {HTMLElement} host - circuit-lab element.
 */
async function loadLabConfigFromElement(host) {
  const src = host.getAttribute("src");
  if (src) {
    return loadLabConfigFromUrl(src);
  }

  const script = findYamlScript(host);
  if (!script) {
    throw new Error(
      'circuit-lab needs a src="….yaml" attribute or a <script type="text/yaml"> child.'
    );
  }
  return normalizeLabConfig(parseLabYaml(script.textContent || ""));
}
