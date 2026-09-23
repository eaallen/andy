/**
 * @typedef {{ componentId: string, terminalId?: string }} HintRefTarget
 * @typedef {{ type: "text", value: string } | { type: "ref", value: string, display: string, componentId: string, terminalId?: string }} HintSegment
 */

/**
 * Formats a catalog id as a bracketed hint token.
 * @param {string} id - Component, load, or terminal id.
 */
export function formatHintRef(id) {
  return "[" + String(id) + "]";
}

/**
 * Formats ids as a comma-separated list of bracketed hint tokens.
 * @param {string[]} ids - Catalog ids.
 */
export function formatHintRefList(ids) {
  const parts = [];
  for (let i = 0; i < ids.length; i += 1) {
    parts.push(formatHintRef(ids[i]));
  }
  return parts.join(", ");
}

/**
 * Pushes a normalized endpoint onto a list when it has component + terminal.
 * @param {Array<{ component: string, terminal: string }>} out - Endpoint list.
 * @param {{ component?: string, terminal?: string }|null|undefined} endpoint - Endpoint ref.
 */
function pushEndpoint(out, endpoint) {
  if (!endpoint || endpoint.component == null || endpoint.terminal == null) {
    return;
  }
  out.push({
    component: String(endpoint.component),
    terminal: String(endpoint.terminal),
  });
}

/**
 * Collects endpoints referenced by simulation and grading (for terminal hint tokens).
 * @param {{ simulation?: object|null, grading?: object|null }} config - Normalized lab config.
 */
function collectConfigEndpoints(config) {
  /** @type {Array<{ component: string, terminal: string }>} */
  const endpoints = [];
  const simulation = config && config.simulation;
  if (simulation) {
    if (simulation.supply) {
      const hots = Array.isArray(simulation.supply.hot)
        ? simulation.supply.hot
        : simulation.supply.hot
          ? [simulation.supply.hot]
          : [];
      for (let h = 0; h < hots.length; h += 1) {
        pushEndpoint(endpoints, hots[h]);
      }
      pushEndpoint(endpoints, simulation.supply.return);
    }
    const loads = Array.isArray(simulation.loads) ? simulation.loads : [];
    for (let i = 0; i < loads.length; i += 1) {
      pushEndpoint(endpoints, loads[i].requireHot);
      pushEndpoint(endpoints, loads[i].signal);
    }
  }

  const grading = config && config.grading;
  if (grading && Array.isArray(grading.continuity)) {
    for (let c = 0; c < grading.continuity.length; c += 1) {
      pushEndpoint(endpoints, grading.continuity[c].from);
      pushEndpoint(endpoints, grading.continuity[c].to);
    }
  }

  return endpoints;
}

/**
 * Builds a token → target catalog from normalized lab config.
 * - Component ids → whole component
 * - Load ids (when not also a component id) → load signal terminal (else requireHot)
 * - `component.terminal` and uniquely owned bare terminal ids from simulation/grading endpoints
 * @param {{ components?: Array<{ id: string }>, simulation?: object|null, grading?: object|null }} config - Normalized lab config.
 */
export function buildHintRefCatalog(config) {
  /** @type {{ [token: string]: HintRefTarget }} */
  const catalog = {};
  const components = config && Array.isArray(config.components) ? config.components : [];
  for (let i = 0; i < components.length; i += 1) {
    const id = components[i] && components[i].id != null ? String(components[i].id) : "";
    if (id) {
      catalog[id] = { componentId: id };
    }
  }

  const loads =
    config &&
    config.simulation &&
    Array.isArray(config.simulation.loads)
      ? config.simulation.loads
      : [];
  for (let j = 0; j < loads.length; j += 1) {
    const load = loads[j];
    if (!load || load.id == null) {
      continue;
    }
    const loadId = String(load.id);
    if (!loadId || catalog[loadId]) {
      // Prefer the component mapping when load id equals a component id (e.g. lamp).
      continue;
    }
    const endpoint = load.signal || load.requireHot || null;
    if (endpoint && endpoint.component) {
      /** @type {HintRefTarget} */
      const target = { componentId: String(endpoint.component) };
      if (endpoint.terminal) {
        target.terminalId = String(endpoint.terminal);
      }
      catalog[loadId] = target;
    }
  }

  const endpoints = collectConfigEndpoints(config);
  /** @type {{ [terminalId: string]: HintRefTarget|null }} */
  const bareTerminalOwner = {};
  for (let e = 0; e < endpoints.length; e += 1) {
    const ep = endpoints[e];
    const dotted = ep.component + "." + ep.terminal;
    const target = { componentId: ep.component, terminalId: ep.terminal };
    catalog[dotted] = target;

    if (Object.prototype.hasOwnProperty.call(catalog, ep.terminal)) {
      // Already a component id, load id, or prior terminal token — leave it.
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(bareTerminalOwner, ep.terminal)) {
      bareTerminalOwner[ep.terminal] = target;
    } else {
      const prior = bareTerminalOwner[ep.terminal];
      if (
        !prior ||
        prior.componentId !== target.componentId ||
        prior.terminalId !== target.terminalId
      ) {
        // Same terminal id on multiple components — not safe as a bare token.
        bareTerminalOwner[ep.terminal] = null;
      }
    }
  }

  const bareIds = Object.keys(bareTerminalOwner);
  for (let b = 0; b < bareIds.length; b += 1) {
    const terminalId = bareIds[b];
    const owner = bareTerminalOwner[terminalId];
    if (owner && !Object.prototype.hasOwnProperty.call(catalog, terminalId)) {
      catalog[terminalId] = owner;
    }
  }

  return catalog;
}

/**
 * Resolves a bracketed or raw hint token to a display string and highlight target.
 * @param {string} token - Raw token, optionally wrapped in [].
 * @param {{ [token: string]: HintRefTarget }} catalog - Token → target map.
 */
export function resolveHintRef(token, catalog) {
  if (token == null || !catalog) {
    return null;
  }
  let raw = String(token);
  if (raw.length >= 2 && raw.charAt(0) === "[" && raw.charAt(raw.length - 1) === "]") {
    raw = raw.slice(1, -1);
  }
  if (!raw || !Object.prototype.hasOwnProperty.call(catalog, raw)) {
    return null;
  }
  const target = catalog[raw];
  return {
    display: raw,
    componentId: target.componentId,
    terminalId: target.terminalId,
  };
}

/**
 * Splits hint text into plain and clickable ref segments.
 * Only `[token]` spans are linkified; tokens must exist in the catalog.
 * @param {string} text - Hint / fail message text.
 * @param {{ [token: string]: HintRefTarget }} catalog - Token → target map.
 */
export function linkifyHintText(text, catalog) {
  const source = text == null ? "" : String(text);
  if (!source || !catalog) {
    return source ? [{ type: "text", value: source }] : [];
  }

  /** @type {HintSegment[]} */
  const segments = [];
  const pattern = /\[([^\]]+)\]/g;
  let cursor = 0;
  let match = pattern.exec(source);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const token = match[1];
    if (start > cursor) {
      segments.push({ type: "text", value: source.slice(cursor, start) });
    }
    if (Object.prototype.hasOwnProperty.call(catalog, token)) {
      const target = catalog[token];
      /** @type {{ type: "ref", value: string, display: string, componentId: string, terminalId?: string }} */
      const ref = {
        type: "ref",
        value: match[0],
        display: token,
        componentId: target.componentId,
      };
      if (target.terminalId) {
        ref.terminalId = target.terminalId;
      }
      segments.push(ref);
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    cursor = end;
    match = pattern.exec(source);
  }
  if (cursor < source.length) {
    segments.push({ type: "text", value: source.slice(cursor) });
  }
  if (segments.length === 0 && source) {
    segments.push({ type: "text", value: source });
  }
  return segments;
}

/**
 * Renders a fail hint with clickable component/load refs (no innerHTML of author text).
 * @param {HTMLElement} hintEl - Hint container element.
 * @param {string} text - Fail message.
 * @param {{ [token: string]: HintRefTarget }} catalog - Token → target map.
 * @param {(segment: { componentId: string, terminalId?: string }) => void} onRefClick - Called when a ref button is clicked.
 */
export function renderFailHint(hintEl, text, catalog, onRefClick) {
  hintEl.textContent = "";
  const segments = linkifyHintText(text, catalog);
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.type === "ref" && segment.componentId) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lab-hint-ref";
      btn.textContent = segment.display || segment.value;
      btn.addEventListener("click", function () {
        onRefClick({
          componentId: segment.componentId,
          terminalId: segment.terminalId,
        });
      });
      hintEl.appendChild(btn);
    } else {
      hintEl.appendChild(document.createTextNode(segment.value));
    }
  }
}
