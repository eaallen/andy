import yaml from "js-yaml";

/**
 * Reads and normalizes a circuit-lab YAML or JSON definition into a runtime config.
 *
 * Lab file fields (YAML or JSON — both parsed with js-yaml):
 *   title, margin, hints.{demo,lab}, passMessage
 *   components[]: { id, type, label?, x, y }
 *   demo.wires[]: { from, to, color? } or [from, to, color?]
 *     Endpoints are "componentId.terminalId".
 *   simulation (optional until the lab defines it):
 *     supply: { hot, return } — "component.terminal" refs
 *     loads[]: { id, requireHot, signal, feedback?: { type, profile? } }
 *     switches[]?: { id, bridges: [[a,b], ...] } — override default button bridges
 *   grading (optional until the lab defines it):
 *     required[]: component ids that must be present
 *     continuity[]: { from, to, fail? }
 *     whenClosed[]: { switch, energize: [loadId, ...] }
 *
 * Built-in component types (factories live in components.js):
 *   power, transformer, chime, terminal-block, button, switch, lamp
 */

const LAB_SCRIPT_TYPES = {
  yaml: ["text/yaml", "application/yaml", "text/x-yaml"],
  json: ["application/json", "text/json"],
};

/**
 * Builds an Error with a clear, AI-friendly message for lab config problems.
 * @param {string} message - What went wrong and how to fix it.
 */
function labConfigError(message) {
  return new Error("Lab config error: " + message);
}

/**
 * Infers whether a URL path looks like YAML or JSON for clearer parse errors.
 * @param {string} url - Lab file URL or path.
 */
function inferSourceKindFromUrl(url) {
  const path = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  if (path.endsWith(".json")) {
    return "json";
  }
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return "yaml";
  }
  return "unknown";
}

/**
 * Infers source kind from a script type attribute.
 * @param {string} type - Script type attribute (lowercased).
 */
function inferSourceKindFromScriptType(type) {
  if (LAB_SCRIPT_TYPES.json.indexOf(type) !== -1) {
    return "json";
  }
  if (LAB_SCRIPT_TYPES.yaml.indexOf(type) !== -1) {
    return "yaml";
  }
  return null;
}

/**
 * Finds the first YAML or JSON lab script child inside a host element.
 * @param {HTMLElement} host - Custom element or container that holds the lab definition.
 */
function findLabScript(host) {
  const scripts = host.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i += 1) {
    const type = (scripts[i].getAttribute("type") || "").toLowerCase();
    if (inferSourceKindFromScriptType(type)) {
      return scripts[i];
    }
  }
  return null;
}

/**
 * Parses a lab source string (YAML or JSON) into a plain object via js-yaml only.
 * JSON is a subset of YAML 1.2, so the same loader handles both.
 * @param {string} source - Raw YAML or JSON text.
 * @param {"yaml"|"json"|"unknown"} [kind] - Hint used only in error messages.
 */
export function parseLabSource(source, kind) {
  if (!yaml || !yaml.load) {
    throw labConfigError("js-yaml is required to parse circuit-lab definitions.");
  }

  const text = String(source == null ? "" : source);
  if (!text.trim()) {
    throw labConfigError("Lab definition is empty.");
  }

  let data;
  try {
    data = yaml.load(text);
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    const label = kind === "json" ? "JSON" : kind === "yaml" ? "YAML" : "YAML/JSON";
    throw labConfigError("Failed to parse lab " + label + ": " + detail);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw labConfigError("Lab definition must be a top-level object (mapping), not an array or scalar.");
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
export function resolveCoord(value, axis, stage) {
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
 * @param {string} [context] - Where this endpoint appears (for error messages).
 */
function parseWireEndpoint(endpoint, context) {
  const text = String(endpoint || "");
  const sep = text.lastIndexOf(".");
  if (sep <= 0 || sep === text.length - 1) {
    const where = context ? " (" + context + ")" : "";
    throw labConfigError(
      'Endpoint must look like "component.terminal"' + where + ", got: " + JSON.stringify(text)
    );
  }
  return {
    component: text.slice(0, sep),
    terminal: text.slice(sep + 1),
  };
}

/**
 * Ensures a component id exists in the lab's component map.
 * @param {string} componentId - Component id to check.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 * @param {string} context - Where the reference appears.
 */
function assertKnownComponent(componentId, componentById, context) {
  if (!componentById[componentId]) {
    const known = Object.keys(componentById).join(", ") || "(none)";
    throw labConfigError(
      context +
        ' references unknown component "' +
        componentId +
        '". Declared ids: ' +
        known +
        "."
    );
  }
}

/**
 * Parses an endpoint and checks that its component id is declared.
 * @param {string} endpoint - "component.terminal" string.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 * @param {string} context - Where the reference appears.
 */
function parseAndAssertEndpoint(endpoint, componentById, context) {
  const ref = parseWireEndpoint(endpoint, context);
  assertKnownComponent(ref.component, componentById, context);
  return ref;
}

/**
 * Normalizes a demo wire entry from YAML/JSON into { from, to, color }.
 * @param {object|Array} entry - Wire row.
 * @param {number} index - Row index for error messages.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 */
function normalizeWire(entry, index, componentById) {
  const context = "demo.wires[" + index + "]";

  if (Array.isArray(entry)) {
    if (entry.length < 2) {
      throw labConfigError(context + " arrays need at least [from, to].");
    }
    return {
      from: parseAndAssertEndpoint(entry[0], componentById, context + ".from"),
      to: parseAndAssertEndpoint(entry[1], componentById, context + ".to"),
      color: entry[2] || "red",
    };
  }

  if (!entry || typeof entry !== "object") {
    throw labConfigError(context + " must be an object or [from, to, color] array.");
  }

  return {
    from: parseAndAssertEndpoint(entry.from, componentById, context + ".from"),
    to: parseAndAssertEndpoint(entry.to, componentById, context + ".to"),
    color: entry.color || "red",
  };
}

/**
 * Normalizes a component entry from YAML/JSON.
 * @param {object} entry - Component row.
 * @param {number} index - Row index for error messages.
 */
function normalizeComponent(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw labConfigError("components[" + index + "] must be an object.");
  }
  if (!entry.id) {
    throw labConfigError("components[" + index + "] needs an id.");
  }
  if (!entry.type) {
    throw labConfigError('Component "' + entry.id + '" needs a type.');
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
 * Builds a map of component id → normalized entry; rejects duplicate ids.
 * @param {object[]} components - Normalized component list.
 */
function buildComponentById(components) {
  /** @type {{ [id: string]: object }} */
  const map = {};
  for (let i = 0; i < components.length; i += 1) {
    const id = components[i].id;
    if (map[id]) {
      throw labConfigError('Duplicate component id "' + id + '". Each id must be unique.');
    }
    map[id] = components[i];
  }
  return map;
}

/**
 * Normalizes load feedback (sound / light / etc.).
 * @param {object|undefined} feedback - Raw feedback object.
 * @param {string} context - Where this feedback appears.
 */
function normalizeFeedback(feedback, context) {
  if (feedback == null) {
    return null;
  }
  if (typeof feedback !== "object" || Array.isArray(feedback)) {
    throw labConfigError(context + ".feedback must be an object like { type: sound, profile: dingDong }.");
  }
  if (!feedback.type) {
    throw labConfigError(context + '.feedback needs a type (e.g. "sound" or "light").');
  }
  return {
    type: String(feedback.type),
    profile: feedback.profile != null ? String(feedback.profile) : undefined,
  };
}

/**
 * Normalizes one simulation load entry.
 * @param {object} entry - Raw load row.
 * @param {number} index - Row index for error messages.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 */
function normalizeLoad(entry, index, componentById) {
  const context = "simulation.loads[" + index + "]";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw labConfigError(context + " must be an object.");
  }
  if (!entry.id) {
    throw labConfigError(context + " needs an id.");
  }
  if (entry.requireHot == null) {
    throw labConfigError(context + ' ("' + entry.id + '") needs requireHot: "component.terminal".');
  }
  if (entry.signal == null) {
    throw labConfigError(context + ' ("' + entry.id + '") needs signal: "component.terminal".');
  }

  return {
    id: String(entry.id),
    requireHot: parseAndAssertEndpoint(entry.requireHot, componentById, context + ".requireHot"),
    signal: parseAndAssertEndpoint(entry.signal, componentById, context + ".signal"),
    feedback: normalizeFeedback(entry.feedback, context),
  };
}

/**
 * Normalizes an optional switch bridge override.
 * bridges default at runtime to [com, sig] for button-like switches when omitted.
 * @param {object} entry - Raw switch row.
 * @param {number} index - Row index for error messages.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 */
function normalizeSwitchOverride(entry, index, componentById) {
  const context = "simulation.switches[" + index + "]";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw labConfigError(context + " must be an object with id and optional bridges.");
  }
  if (!entry.id) {
    throw labConfigError(context + " needs an id (component id of the switch/button).");
  }
  const id = String(entry.id);
  assertKnownComponent(id, componentById, context);

  /** @type {Array<[string, string]>} */
  const bridges = [];
  if (entry.bridges != null) {
    if (!Array.isArray(entry.bridges)) {
      throw labConfigError(
        context +
          ".bridges must be an array of [terminalA, terminalB] pairs (e.g. [[com, sig]])."
      );
    }
    for (let i = 0; i < entry.bridges.length; i += 1) {
      const pair = entry.bridges[i];
      if (!Array.isArray(pair) || pair.length < 2) {
        throw labConfigError(
          context + ".bridges[" + i + "] must be [terminalA, terminalB]."
        );
      }
      bridges.push([String(pair[0]), String(pair[1])]);
    }
  }

  return {
    id: id,
    bridges: bridges,
  };
}

/**
 * Normalizes simulation into a stable runtime shape, or null when omitted.
 * @param {object|undefined} raw - Raw simulation block.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 */
function normalizeSimulation(raw, componentById) {
  if (raw == null) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw labConfigError("simulation must be an object with supply and loads.");
  }

  const supplyRaw = raw.supply;
  if (!supplyRaw || typeof supplyRaw !== "object" || Array.isArray(supplyRaw)) {
    throw labConfigError('simulation.supply is required: { hot: "comp.term", return: "comp.term" }.');
  }
  if (supplyRaw.hot == null) {
    throw labConfigError('simulation.supply.hot is required (e.g. "transformer.sec-hot").');
  }
  if (supplyRaw.return == null) {
    throw labConfigError('simulation.supply.return is required (e.g. "transformer.sec-com").');
  }

  if (!Array.isArray(raw.loads) || raw.loads.length === 0) {
    throw labConfigError("simulation.loads must be a non-empty array of load definitions.");
  }

  const loads = raw.loads.map(function (entry, index) {
    return normalizeLoad(entry, index, componentById);
  });

  /** @type {{ [id: string]: boolean }} */
  const loadIds = {};
  for (let i = 0; i < loads.length; i += 1) {
    if (loadIds[loads[i].id]) {
      throw labConfigError('Duplicate simulation load id "' + loads[i].id + '".');
    }
    loadIds[loads[i].id] = true;
  }

  const switches = Array.isArray(raw.switches)
    ? raw.switches.map(function (entry, index) {
        return normalizeSwitchOverride(entry, index, componentById);
      })
    : [];

  return {
    supply: {
      hot: parseAndAssertEndpoint(supplyRaw.hot, componentById, "simulation.supply.hot"),
      return: parseAndAssertEndpoint(supplyRaw.return, componentById, "simulation.supply.return"),
    },
    loads: loads,
    switches: switches,
  };
}

/**
 * Normalizes one grading continuity check.
 * @param {object} entry - Raw continuity row.
 * @param {number} index - Row index for error messages.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 */
function normalizeContinuityCheck(entry, index, componentById) {
  const context = "grading.continuity[" + index + "]";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw labConfigError(context + " must be an object with from, to, and optional fail.");
  }
  if (entry.from == null || entry.to == null) {
    throw labConfigError(context + ' needs from and to as "component.terminal" strings.');
  }
  return {
    from: parseAndAssertEndpoint(entry.from, componentById, context + ".from"),
    to: parseAndAssertEndpoint(entry.to, componentById, context + ".to"),
    fail: entry.fail != null ? String(entry.fail) : "Expected continuity was not found.",
  };
}

/**
 * Normalizes one whenClosed grading rule.
 * @param {object} entry - Raw whenClosed row.
 * @param {number} index - Row index for error messages.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 * @param {{ [id: string]: boolean }|null} loadIds - Known simulation load ids, or null if no simulation.
 */
function normalizeWhenClosed(entry, index, componentById, loadIds) {
  const context = "grading.whenClosed[" + index + "]";
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw labConfigError(context + " must be an object with switch and energize.");
  }
  if (!entry.switch) {
    throw labConfigError(context + " needs switch: <component id>.");
  }
  const switchId = String(entry.switch);
  assertKnownComponent(switchId, componentById, context + ".switch");

  if (!Array.isArray(entry.energize)) {
    throw labConfigError(
      context + " needs energize: an array of load ids (e.g. [front] or [])."
    );
  }

  const energize = entry.energize.map(function (loadId, loadIndex) {
    const id = String(loadId);
    if (loadIds && !loadIds[id]) {
      const known = Object.keys(loadIds).join(", ") || "(none)";
      throw labConfigError(
        context +
          ".energize[" +
          loadIndex +
          '] references unknown load "' +
          id +
          '". simulation.loads ids: ' +
          known +
          "."
      );
    }
    return id;
  });

  return {
    switch: switchId,
    energize: energize,
  };
}

/**
 * Normalizes grading into a stable runtime shape, or null when omitted.
 * @param {object|undefined} raw - Raw grading block.
 * @param {{ [id: string]: object }} componentById - Map of declared components.
 * @param {{ [id: string]: boolean }|null} loadIds - Known simulation load ids, or null if no simulation.
 */
function normalizeGrading(raw, componentById, loadIds) {
  if (raw == null) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw labConfigError("grading must be an object with required, continuity, and/or whenClosed.");
  }

  const requiredRaw = Array.isArray(raw.required) ? raw.required : [];
  const required = requiredRaw.map(function (id, index) {
    const componentId = String(id);
    assertKnownComponent(componentId, componentById, "grading.required[" + index + "]");
    return componentId;
  });

  const continuity = Array.isArray(raw.continuity)
    ? raw.continuity.map(function (entry, index) {
        return normalizeContinuityCheck(entry, index, componentById);
      })
    : [];

  const whenClosed = Array.isArray(raw.whenClosed)
    ? raw.whenClosed.map(function (entry, index) {
        return normalizeWhenClosed(entry, index, componentById, loadIds);
      })
    : [];

  if (whenClosed.length > 0 && !loadIds) {
    throw labConfigError(
      "grading.whenClosed requires a simulation block with loads so energize ids can be checked."
    );
  }

  return {
    required: required,
    continuity: continuity,
    whenClosed: whenClosed,
  };
}

/**
 * Builds the runtime lab config used by the Konva app.
 * @param {object} raw - Parsed YAML/JSON object.
 */
export function normalizeLabConfig(raw) {
  const margin = typeof raw.margin === "number" ? raw.margin : 40;
  const components = (Array.isArray(raw.components) ? raw.components : []).map(
    normalizeComponent
  );
  const componentById = buildComponentById(components);

  const demo = raw.demo && typeof raw.demo === "object" ? raw.demo : {};
  const hints = raw.hints && typeof raw.hints === "object" ? raw.hints : {};
  const wires = Array.isArray(demo.wires)
    ? demo.wires.map(function (entry, index) {
        return normalizeWire(entry, index, componentById);
      })
    : [];

  const simulation = normalizeSimulation(raw.simulation, componentById);

  /** @type {{ [id: string]: boolean }|null} */
  let loadIds = null;
  if (simulation) {
    loadIds = {};
    for (let i = 0; i < simulation.loads.length; i += 1) {
      loadIds[simulation.loads[i].id] = true;
    }
  }

  const grading = normalizeGrading(raw.grading, componentById, loadIds);

  return {
    title: raw.title ? String(raw.title) : "Circuit Lab",
    margin: margin,
    hints: {
      demo: hints.demo ? String(hints.demo) : "",
      lab: hints.lab ? String(hints.lab) : "",
    },
    components: components,
    demoWires: wires,
    passMessage: raw.passMessage
      ? String(raw.passMessage)
      : "Pass — circuit matches the expected wiring.",
    simulation: simulation,
    grading: grading,
  };
}

/**
 * Fetches and normalizes lab config from a YAML or JSON URL.
 * @param {string} url - Path to a .yaml / .yml / .json file.
 */
async function loadLabConfigFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw labConfigError(
      "Failed to load lab file from " + url + " (HTTP " + response.status + ")."
    );
  }
  const kind = inferSourceKindFromUrl(url);
  return normalizeLabConfig(parseLabSource(await response.text(), kind));
}

/**
 * Loads lab config from a host element's src attribute or inline YAML/JSON script.
 * Prefers src="labs/foo.yaml" (or .json); falls back to a matching <script> child.
 * @param {HTMLElement} host - circuit-lab element.
 */
export async function loadLabConfigFromElement(host) {
  const src = host.getAttribute("src");
  if (src) {
    return loadLabConfigFromUrl(src);
  }

  const script = findLabScript(host);
  if (!script) {
    throw labConfigError(
      'circuit-lab needs a src="….yaml|….json" attribute or a ' +
        '<script type="text/yaml"> / type="application/json"> child.'
    );
  }
  const kind = inferSourceKindFromScriptType(
    (script.getAttribute("type") || "").toLowerCase()
  );
  return normalizeLabConfig(parseLabSource(script.textContent || "", kind || "unknown"));
}
