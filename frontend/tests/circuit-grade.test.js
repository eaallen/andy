import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCircuitSimulator } from "../js/circuit.js";
import { createGrader } from "../js/grade.js";
import { TERMINAL_ROLES } from "../js/components/constants.js";
import {
  normalizeLabConfig,
  parseLabSource,
} from "../js/lab-config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Builds a plain terminal object for unit tests (no Konva).
 * @param {string} componentId - Instance id used in terminal keys.
 * @param {string} id - Local terminal id.
 * @param {string} [role] - Optional terminal role.
 */
function makeTerminal(componentId, id, role) {
  const group = { componentId: componentId };
  return {
    id: id,
    role: role,
    componentGroup: group,
    node: {
      shadowColor: function () {},
      shadowBlur: function () {},
      shadowEnabled: function () {},
    },
  };
}

/**
 * Builds a plain component group for unit tests.
 * @param {string} configId - Layout / config component id.
 * @param {string} type - Component type string.
 * @param {Array<{ id: string, role?: string }>} terminalDefs - Terminal definitions.
 * @param {{ isSwitch?: boolean, switchKind?: string }} [options] - Extra component flags.
 */
function makeComponent(configId, type, terminalDefs, options) {
  const componentId = configId + "-inst";
  const terminals = terminalDefs.map(function (def) {
    return makeTerminal(componentId, def.id, def.role);
  });
  const group = {
    configId: configId,
    componentId: componentId,
    componentType: type,
    terminals: terminals,
    isSwitch: !!(options && options.isSwitch),
    switchKind: options && options.switchKind ? options.switchKind : undefined,
  };
  for (let i = 0; i < terminals.length; i += 1) {
    terminals[i].componentGroup = group;
  }
  return group;
}

/**
 * Looks up a terminal on a component by id.
 * @param {object} component - Component group.
 * @param {string} terminalId - Terminal id.
 */
function term(component, terminalId) {
  for (let i = 0; i < component.terminals.length; i += 1) {
    if (component.terminals[i].id === terminalId) {
      return component.terminals[i];
    }
  }
  return null;
}

/**
 * Builds a minimal doorbell-like simulation config.
 */
function doorbellSimulation() {
  return {
    supply: {
      hot: { component: "transformer", terminal: "sec-hot" },
      return: { component: "transformer", terminal: "sec-com" },
    },
    loads: [
      {
        id: "front",
        requireHot: { component: "chime", terminal: "trans" },
        signal: { component: "chime", terminal: "front" },
        feedback: { type: "sound", profile: "dingDong" },
      },
      {
        id: "rear",
        requireHot: { component: "chime", terminal: "trans" },
        signal: { component: "chime", terminal: "rear" },
        feedback: { type: "sound", profile: "buzz" },
      },
    ],
    switches: [],
  };
}

/**
 * Builds doorbell grading rules.
 */
function doorbellGrading() {
  return {
    required: [
      "transformer",
      "chime",
      "buttonFront",
      "buttonRear",
      "buttonSide",
    ],
    continuity: [
      {
        from: { component: "transformer", terminal: "sec-hot" },
        to: { component: "chime", terminal: "trans" },
        fail: "Chime Trans is not powered from the transformer 24V hot.",
      },
    ],
    whenClosed: [
      { switch: "buttonFront", energize: ["front"] },
      { switch: "buttonRear", energize: ["rear"] },
      { switch: "buttonSide", energize: ["rear"] },
    ],
  };
}

/**
 * Creates a wired doorbell fixture: hot→trans, com→buttons, signals→chime.
 */
function createDoorbellFixture() {
  const transformer = makeComponent("transformer", "transformer", [
    { id: "sec-hot", role: TERMINAL_ROLES.HOT_24V },
    { id: "sec-com", role: TERMINAL_ROLES.COM_24V },
  ]);
  const chime = makeComponent("chime", "chime", [
    { id: "front", role: TERMINAL_ROLES.CHIME_FRONT },
    { id: "trans", role: TERMINAL_ROLES.CHIME_TRANS },
    { id: "rear", role: TERMINAL_ROLES.CHIME_REAR },
  ]);
  const buttonFront = makeComponent(
    "buttonFront",
    "button",
    [
      { id: "com", role: TERMINAL_ROLES.BTN_COMMON },
      { id: "sig", role: TERMINAL_ROLES.BTN_SIGNAL },
    ],
    { isSwitch: true }
  );
  const buttonRear = makeComponent(
    "buttonRear",
    "button",
    [
      { id: "com", role: TERMINAL_ROLES.BTN_COMMON },
      { id: "sig", role: TERMINAL_ROLES.BTN_SIGNAL },
    ],
    { isSwitch: true }
  );
  const buttonSide = makeComponent(
    "buttonSide",
    "button",
    [
      { id: "com", role: TERMINAL_ROLES.BTN_COMMON },
      { id: "sig", role: TERMINAL_ROLES.BTN_SIGNAL },
    ],
    { isSwitch: true }
  );

  const components = {
    transformer: transformer,
    chime: chime,
    buttonFront: buttonFront,
    buttonRear: buttonRear,
    buttonSide: buttonSide,
  };

  const wires = [
    { from: term(transformer, "sec-hot"), to: term(chime, "trans") },
    { from: term(transformer, "sec-com"), to: term(buttonFront, "com") },
    { from: term(transformer, "sec-com"), to: term(buttonRear, "com") },
    { from: term(transformer, "sec-com"), to: term(buttonSide, "com") },
    { from: term(buttonFront, "sig"), to: term(chime, "front") },
    { from: term(buttonRear, "sig"), to: term(chime, "rear") },
    { from: term(buttonSide, "sig"), to: term(chime, "rear") },
  ];

  return { components: components, wires: wires };
}

describe("createCircuitSimulator", () => {
  it("energizes only the front load when buttonFront is closed", () => {
    const fixture = createDoorbellFixture();
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );

    const result = simulator.simulate(["buttonFront"]);
    expect(result.energized).toEqual({ front: true, rear: false });
  });

  it("lets rear and side share the rear load path", () => {
    const fixture = createDoorbellFixture();
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );

    expect(simulator.simulate(["buttonRear"]).energized).toEqual({
      front: false,
      rear: true,
    });
    expect(simulator.simulate(["buttonSide"]).energized).toEqual({
      front: false,
      rear: true,
    });
  });

  it("does not energize loads when no switch is closed", () => {
    const fixture = createDoorbellFixture();
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );

    expect(simulator.simulate([]).energized).toEqual({
      front: false,
      rear: false,
    });
  });

  it("checks wire-only continuity without switch bridges", () => {
    const fixture = createDoorbellFixture();
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );

    const hot = term(fixture.components.transformer, "sec-hot");
    const trans = term(fixture.components.chime, "trans");
    const front = term(fixture.components.chime, "front");
    expect(simulator.areWiredTogether(hot, trans)).toBe(true);
    expect(simulator.areWiredTogether(hot, front)).toBe(false);
  });

  it("uses YAML switch bridge overrides when provided", () => {
    const supply = makeComponent("supply", "transformer", [
      { id: "hot" },
      { id: "ret" },
    ]);
    const lamp = makeComponent("lamp", "lamp", [{ id: "hot" }, { id: "n" }]);
    const sw = makeComponent("sw1", "switch", [{ id: "a" }, { id: "b" }], {
      isSwitch: true,
    });
    const components = { supply: supply, lamp: lamp, sw1: sw };
    const wires = [
      { from: term(supply, "hot"), to: term(lamp, "hot") },
      { from: term(supply, "ret"), to: term(sw, "a") },
      { from: term(sw, "b"), to: term(lamp, "n") },
    ];
    const simulation = {
      supply: {
        hot: { component: "supply", terminal: "hot" },
        return: { component: "supply", terminal: "ret" },
      },
      loads: [
        {
          id: "lamp",
          requireHot: { component: "lamp", terminal: "hot" },
          signal: { component: "lamp", terminal: "n" },
          feedback: { type: "light" },
        },
      ],
      switches: [{ id: "sw1", bridges: [["a", "b"]] }],
    };

    const simulator = createCircuitSimulator(
      function () {
        return wires;
      },
      function () {
        return components;
      },
      simulation
    );

    expect(simulator.simulate([]).energized.lamp).toBe(false);
    expect(simulator.simulate(["sw1"]).energized.lamp).toBe(true);
  });

  it("bridges SPST switch COM to NO by default when closed", () => {
    const supply = makeComponent("supply", "transformer", [
      { id: "hot" },
      { id: "ret" },
    ]);
    const lamp = makeComponent("lamp", "lamp", [
      { id: "hot", role: TERMINAL_ROLES.LOAD_HOT },
      { id: "n", role: TERMINAL_ROLES.LOAD_NEUTRAL },
    ]);
    const sw = makeComponent(
      "sw1",
      "switch",
      [
        { id: "com", role: TERMINAL_ROLES.SWITCH_COM },
        { id: "no", role: TERMINAL_ROLES.SWITCH_NO },
      ],
      { isSwitch: true }
    );
    const components = { supply: supply, lamp: lamp, sw1: sw };
    const wires = [
      { from: term(supply, "hot"), to: term(lamp, "hot") },
      { from: term(supply, "ret"), to: term(sw, "com") },
      { from: term(sw, "no"), to: term(lamp, "n") },
    ];
    const simulation = {
      supply: {
        hot: { component: "supply", terminal: "hot" },
        return: { component: "supply", terminal: "ret" },
      },
      loads: [
        {
          id: "lamp",
          requireHot: { component: "lamp", terminal: "hot" },
          signal: { component: "lamp", terminal: "n" },
          feedback: { type: "light" },
        },
      ],
      switches: [],
    };

    const simulator = createCircuitSimulator(
      function () {
        return wires;
      },
      function () {
        return components;
      },
      simulation
    );

    expect(simulator.simulate([]).energized.lamp).toBe(false);
    expect(simulator.simulate(["sw1"]).energized.lamp).toBe(true);
  });
});

describe("createGrader", () => {
  it("passes a correctly wired doorbell circuit", () => {
    const fixture = createDoorbellFixture();
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      doorbellGrading()
    );

    const result = grader.grade();
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails when required components are missing", () => {
    const fixture = createDoorbellFixture();
    delete fixture.components.buttonSide;
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      doorbellGrading()
    );

    const result = grader.grade();
    expect(result.pass).toBe(false);
    expect(result.failures[0]).toMatch(/Missing components.*buttonSide/i);
  });

  it("fails continuity with the configured fail message", () => {
    const fixture = createDoorbellFixture();
    fixture.wires = fixture.wires.filter(function (wire) {
      return !(
        wire.from === term(fixture.components.transformer, "sec-hot") &&
        wire.to === term(fixture.components.chime, "trans")
      );
    });
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      doorbellGrading()
    );

    const result = grader.grade();
    expect(result.pass).toBe(false);
    expect(result.failures).toContain(
      "Chime Trans is not powered from the transformer 24V hot."
    );
  });

  it("fails whenClosed when the wrong load energizes", () => {
    const fixture = createDoorbellFixture();
    // Cross-wire front button onto the rear chime path.
    fixture.wires = fixture.wires.filter(function (wire) {
      return !(
        wire.from === term(fixture.components.buttonFront, "sig") &&
        wire.to === term(fixture.components.chime, "front")
      );
    });
    fixture.wires.push({
      from: term(fixture.components.buttonFront, "sig"),
      to: term(fixture.components.chime, "rear"),
    });

    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      doorbellSimulation()
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      doorbellGrading()
    );

    const result = grader.grade();
    expect(result.pass).toBe(false);
    expect(
      result.failures.some(function (msg) {
        return /buttonFront/i.test(msg) && /rear/i.test(msg);
      })
    ).toBe(true);
  });
});

/**
 * Default terminal role for common doorbell terminal ids.
 * @param {string} terminalId - Local terminal id.
 */
function roleForTerminalId(terminalId) {
  if (terminalId === "com") {
    return TERMINAL_ROLES.BTN_COMMON;
  }
  if (terminalId === "sig") {
    return TERMINAL_ROLES.BTN_SIGNAL;
  }
  if (terminalId === "sec-hot") {
    return TERMINAL_ROLES.HOT_24V;
  }
  if (terminalId === "sec-com") {
    return TERMINAL_ROLES.COM_24V;
  }
  if (terminalId === "trans") {
    return TERMINAL_ROLES.CHIME_TRANS;
  }
  if (terminalId === "front") {
    return TERMINAL_ROLES.CHIME_FRONT;
  }
  if (terminalId === "rear") {
    return TERMINAL_ROLES.CHIME_REAR;
  }
  return undefined;
}

/**
 * Collects terminal ids referenced by demo wires and simulation endpoints.
 * @param {object} config - Normalized lab config.
 */
function terminalIdsByComponent(config) {
  /** @type {{ [id: string]: { [terminalId: string]: boolean } }} */
  const map = {};

  /**
   * Records one endpoint ref.
   * @param {{ component: string, terminal: string }} ref - Endpoint.
   */
  function add(ref) {
    if (!ref || !ref.component || !ref.terminal) {
      return;
    }
    if (!map[ref.component]) {
      map[ref.component] = {};
    }
    map[ref.component][ref.terminal] = true;
  }

  for (let i = 0; i < config.demoWires.length; i += 1) {
    add(config.demoWires[i].from);
    add(config.demoWires[i].to);
  }

  if (config.simulation) {
    const hots = Array.isArray(config.simulation.supply.hot)
      ? config.simulation.supply.hot
      : [config.simulation.supply.hot];
    for (let h = 0; h < hots.length; h += 1) {
      add(hots[h]);
    }
    add(config.simulation.supply.return);
    for (let j = 0; j < config.simulation.loads.length; j += 1) {
      add(config.simulation.loads[j].requireHot);
      add(config.simulation.loads[j].signal);
    }
  }

  return map;
}

/**
 * Builds a live component/wire fixture from a normalized lab config.
 * @param {object} config - Output of normalizeLabConfig.
 */
function createFixtureFromLabConfig(config) {
  const terminalsNeeded = terminalIdsByComponent(config);
  /** @type {{ [id: string]: object }} */
  const components = {};

  for (let i = 0; i < config.components.length; i += 1) {
    const entry = config.components[i];
    const terminalMap = terminalsNeeded[entry.id] || {};
    const terminalDefs = Object.keys(terminalMap).map(function (id) {
      return { id: id, role: roleForTerminalId(id) };
    });
    const switchKinds = {
      button: undefined,
      switch: "spst",
      "three-way": "three-way",
      "four-way": "four-way",
    };
    const isSwitch = Object.prototype.hasOwnProperty.call(switchKinds, entry.type);
    components[entry.id] = makeComponent(entry.id, entry.type, terminalDefs, {
      isSwitch: isSwitch,
      switchKind: switchKinds[entry.type],
    });
  }

  const wires = config.demoWires.map(function (wire) {
    return {
      from: term(components[wire.from.component], wire.from.terminal),
      to: term(components[wire.to.component], wire.to.terminal),
    };
  });

  return { components: components, wires: wires };
}

describe("doorbell.yaml parity", () => {
  /**
   * Loads and normalizes the shipped doorbell lab file.
   */
  function loadDoorbellConfig() {
    const yaml = readFileSync(join(root, "public/labs/doorbell.yaml"), "utf8");
    return normalizeLabConfig(parseLabSource(yaml, "yaml"));
  }

  it("keeps Front own-chime and shared Rear/Side behavior from demo wires", () => {
    const config = loadDoorbellConfig();
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );

    expect(simulator.simulate([]).energized).toEqual({
      front: false,
      rear: false,
    });
    expect(simulator.simulate(["buttonFront"]).energized).toEqual({
      front: true,
      rear: false,
    });
    expect(simulator.simulate(["buttonRear"]).energized).toEqual({
      front: false,
      rear: true,
    });
    expect(simulator.simulate(["buttonSide"]).energized).toEqual({
      front: false,
      rear: true,
    });
  });

  it("passes Check grading on the YAML demo wiring", () => {
    const config = loadDoorbellConfig();
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      config.grading
    );

    const result = grader.grade();
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
    expect(config.passMessage).toMatch(/Front has its own chime/i);
    expect(config.simulation.loads.map(function (load) {
      return load.feedback && load.feedback.profile;
    })).toEqual(["dingDong", "buzz"]);
  });
});

describe("Utah exam catalog labs", () => {
  /**
   * Loads a lab YAML from public/labs and normalizes it.
   * @param {string} fileName - Lab file name under public/labs.
   */
  function loadLab(fileName) {
    const yaml = readFileSync(join(root, "public/labs", fileName), "utf8");
    return normalizeLabConfig(parseLabSource(yaml, "yaml"));
  }

  /**
   * Grades the demo wiring for a normalized lab config.
   * @param {object} config - Normalized lab config.
   */
  function gradeDemoWiring(config) {
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );
    const grader = createGrader(
      simulator,
      function () {
        return fixture.components;
      },
      config.grading
    );
    return grader.grade();
  }

  it("passes Check on three-way demo wiring for all traveler combinations", () => {
    const config = loadLab("three-way-lamp.yaml");
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );

    expect(simulator.simulate([]).energized.lamp).toBe(true);
    expect(simulator.simulate(["sw1"]).energized.lamp).toBe(false);
    expect(simulator.simulate(["sw2"]).energized.lamp).toBe(false);
    expect(simulator.simulate(["sw1", "sw2"]).energized.lamp).toBe(true);
    expect(gradeDemoWiring(config).pass).toBe(true);
  });

  it("passes Check on four-way demo wiring", () => {
    const config = loadLab("four-way-lamp.yaml");
    expect(gradeDemoWiring(config).pass).toBe(true);
  });

  it("energizes a LOAD-side receptacle through GFCI LINE↔LOAD bridges", () => {
    const config = loadLab("gfci-downstream.yaml");
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );

    expect(simulator.simulate([]).energized.receptacle).toBe(true);
    expect(gradeDemoWiring(config).pass).toBe(true);
  });

  it("energizes both multi-wire loads from L1 and L2", () => {
    const config = loadLab("multi-wire-branch.yaml");
    const fixture = createFixtureFromLabConfig(config);
    const simulator = createCircuitSimulator(
      function () {
        return fixture.wires;
      },
      function () {
        return fixture.components;
      },
      config.simulation
    );

    expect(simulator.simulate([]).energized).toEqual({
      lampA: true,
      lampB: true,
    });
    expect(gradeDemoWiring(config).pass).toBe(true);
  });
});
