import yaml from "js-yaml";
import {
  KNOWN_TYPES,
  WIRE_COLORS,
  terminalsForComponent,
} from "@/lab/catalog.js";

export type LabComponent = {
  id: string;
  type: string;
  label?: string;
  x: number | string;
  y: number | string;
  legs?: number;
};

export type LabWire = {
  from: string;
  to: string;
  color?: string;
};

export type LabConfig = {
  title: string;
  margin?: number;
  passMessage?: string;
  hints?: { demo?: string; lab?: string };
  components: LabComponent[];
  demo?: { wires?: Array<LabWire | [string, string, string?]> };
  simulation?: Record<string, unknown>;
  grading?: Record<string, unknown>;
};

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type ValidatedLab = {
  yaml: string;
  lab: LabConfig;
  issues: ValidationIssue[];
};

/**
 * Strips markdown fences / leading chatter if the model ignores "YAML only".
 */
export function extractYamlDocument(raw: string): string {
  const text = String(raw ?? "").trim();
  if (!text) {
    throw Object.assign(new Error("Model returned an empty response."), {
      status: 502,
      code: "empty_model_response",
    });
  }

  const fenced = text.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  // Drop a leading prose paragraph if the first YAML-ish key appears later.
  const titleIdx = text.search(/^title\s*:/m);
  if (titleIdx > 0) {
    return text.slice(titleIdx).trim();
  }

  return text;
}

function parseEndpoint(endpoint: string): { id: string; terminal: string } | null {
  const raw = String(endpoint ?? "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot === raw.length - 1) {
    return null;
  }
  return { id: raw.slice(0, dot), terminal: raw.slice(dot + 1) };
}

function normalizeWire(
  item: LabWire | [string, string, string?] | unknown,
): LabWire | null {
  if (Array.isArray(item) && item.length >= 2) {
    return {
      from: String(item[0]),
      to: String(item[1]),
      color: item[2] != null ? String(item[2]) : undefined,
    };
  }
  if (item && typeof item === "object") {
    const obj = item as LabWire;
    if (obj.from && obj.to) {
      return {
        from: String(obj.from),
        to: String(obj.to),
        color: obj.color != null ? String(obj.color) : undefined,
      };
    }
  }
  return null;
}

/**
 * Parses and lightly validates Andy lab YAML produced by the model.
 * Errors block the response; warnings are returned alongside success.
 */
export function validateLabYaml(rawYaml: string): ValidatedLab {
  const yamlText = extractYamlDocument(rawYaml);
  const issues: ValidationIssue[] = [];

  let data: unknown;
  try {
    data = yaml.load(yamlText);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw Object.assign(new Error(`Generated YAML failed to parse: ${detail}`), {
      status: 422,
      code: "invalid_yaml",
    });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw Object.assign(
      new Error("Generated YAML must be a top-level mapping/object."),
      { status: 422, code: "invalid_lab_shape" },
    );
  }

  const lab = data as LabConfig;

  if (!lab.title || typeof lab.title !== "string") {
    issues.push({ level: "error", message: "Missing required string field: title" });
  }

  if (!Array.isArray(lab.components) || lab.components.length === 0) {
    issues.push({
      level: "error",
      message: "components must be a non-empty array",
    });
  }

  const byId = new Map<string, LabComponent>();

  for (const [index, component] of (lab.components ?? []).entries()) {
    if (!component || typeof component !== "object") {
      issues.push({
        level: "error",
        message: `components[${index}] must be an object`,
      });
      continue;
    }
    if (!component.id || typeof component.id !== "string") {
      issues.push({
        level: "error",
        message: `components[${index}] is missing id`,
      });
      continue;
    }
    if (byId.has(component.id)) {
      issues.push({
        level: "error",
        message: `Duplicate component id: ${component.id}`,
      });
    }
    byId.set(component.id, component);

    if (!KNOWN_TYPES.has(component.type)) {
      issues.push({
        level: "error",
        message: `Unknown component type "${component.type}" on id ${component.id}`,
      });
    }
    if (component.x == null || component.y == null) {
      issues.push({
        level: "error",
        message: `Component ${component.id} needs x and y`,
      });
    }
  }

  const checkEndpoint = (endpoint: string, context: string) => {
    const parsed = parseEndpoint(endpoint);
    if (!parsed) {
      issues.push({
        level: "error",
        message: `Invalid endpoint "${endpoint}" in ${context} (expected componentId.terminalId)`,
      });
      return;
    }
    const component = byId.get(parsed.id);
    if (!component) {
      issues.push({
        level: "error",
        message: `Unknown component "${parsed.id}" referenced from ${context}`,
      });
      return;
    }
    const allowed = terminalsForComponent(component.type, component.legs);
    if (allowed.length && !allowed.includes(parsed.terminal)) {
      issues.push({
        level: "warning",
        message: `Terminal "${parsed.terminal}" may be invalid for type ${component.type} (${context})`,
      });
    }
  };

  const wires = lab.demo?.wires ?? [];
  for (const [index, item] of wires.entries()) {
    const wire = normalizeWire(item);
    if (!wire) {
      issues.push({
        level: "error",
        message: `demo.wires[${index}] must be {from,to,color?} or [from,to,color?]`,
      });
      continue;
    }
    checkEndpoint(wire.from, `demo.wires[${index}].from`);
    checkEndpoint(wire.to, `demo.wires[${index}].to`);
    if (wire.color && !WIRE_COLORS.has(wire.color)) {
      issues.push({
        level: "warning",
        message: `Unusual wire color "${wire.color}" at demo.wires[${index}] (expected black|white|red|blue|yellow|orange|green|purple|gray)`,
      });
    }
  }

  if (!lab.simulation) {
    issues.push({
      level: "warning",
      message: "No simulation block — Demo energization and Check whenClosed need it",
    });
  }
  if (!lab.grading) {
    issues.push({
      level: "warning",
      message: "No grading block — Check mode will have nothing to grade",
    });
  }

  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) {
    throw Object.assign(
      new Error(
        `Generated lab YAML failed validation:\n` +
          errors.map((e) => `- ${e.message}`).join("\n"),
      ),
      { status: 422, code: "invalid_lab", issues },
    );
  }

  // Re-dump so clients get consistent formatting.
  const normalizedYaml = yaml.dump(lab, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });

  return { yaml: normalizedYaml, lab, issues };
}
