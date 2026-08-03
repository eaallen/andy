import { afterEach, describe, expect, it } from "vitest";
import Konva from "konva";
import { createWireManager } from "../js/wires.js";
import { WIRE_TENSION } from "../js/wire-path.js";
import { lightenHex } from "../js/wire-tint.js";

describe("createWireManager", () => {
  /** @type {Konva.Stage[]} */
  const stages = [];

  afterEach(() => {
    while (stages.length > 0) {
      const stage = stages.pop();
      stage.destroy();
    }
  });

  /**
   * Builds a stage with two fake terminals for wire tests.
   * @param {{
   *   listTerminals?: () => Array<object>,
   *   getView?: () => { scale: number; x: number; y: number },
   * }} [managerOptions] - Optional wire-manager options.
   */
  function makeHarness(managerOptions) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const stage = new Konva.Stage({
      container: container,
      width: 400,
      height: 300,
    });
    stages.push(stage);
    const layer = new Konva.Layer();
    stage.add(layer);

    /**
     * Creates a minimal terminal-like object.
     * @param {string} componentId - Component id.
     * @param {string} id - Terminal id.
     * @param {number} x - World x.
     * @param {number} y - World y.
     */
    function makeTerminal(componentId, id, x, y) {
      const group = new Konva.Group({ x: 0, y: 0 });
      group.componentId = componentId;
      const handle = new Konva.Group({ x: x, y: y });
      const node = new Konva.Circle({ x: 0, y: 0, radius: 6 });
      handle.add(node);
      group.add(handle);
      layer.add(group);
      return {
        id: id,
        node: node,
        handle: handle,
        componentGroup: group,
      };
    }

    const a = makeTerminal("power", "hot", 40, 40);
    const b = makeTerminal("lamp", "load", 200, 40);
    const manager = createWireManager(layer, managerOptions || {});
    stage.draw();
    return { stage: stage, layer: layer, a: a, b: b, manager: manager };
  }

  it("connects terminals once and rejects duplicates", () => {
    const harness = makeHarness();
    const first = harness.manager.connectTerminals(harness.a, harness.b, "red");
    const second = harness.manager.connectTerminals(harness.a, harness.b, "blue");
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(harness.manager.getWires()).toHaveLength(1);
    expect(harness.manager.hasWireBetween(harness.a, harness.b)).toBe(true);
  });

  it("draws tensioned solid wires with an understroke halo", () => {
    const harness = makeHarness();
    const wire = harness.manager.connectTerminals(harness.a, harness.b, "gray");
    expect(wire.line.tension()).toBe(WIRE_TENSION);
    expect(wire.line.dash() || []).toEqual([]);
    expect(wire.understroke).toBeTruthy();
    expect(wire.understroke.listening()).toBe(false);
    expect(wire.understroke.strokeWidth()).toBeGreaterThan(wire.line.strokeWidth());
  });

  it("updates wire color and remembers selection stroke", () => {
    const harness = makeHarness();
    const wire = harness.manager.connectTerminals(harness.a, harness.b, "red");
    harness.manager.selectWire(wire, { x: 100, y: 40 });
    harness.manager.setWireColorKey(wire, "green");
    expect(wire.colorKey).toBe("green");
    expect(wire.line.stroke()).toBe("#16a34a");
    expect(wire.line.strokeWidth()).toBe(5);
  });

  it("tints bend handles from the wire color and shows a press halo", () => {
    const harness = makeHarness({
      getView: function () {
        return { scale: 1, x: 0, y: 0 };
      },
    });
    const wire = harness.manager.connectTerminals(harness.a, harness.b, "red");
    harness.manager.selectWire(wire, { x: 100, y: 40 });
    expect(wire.midHandles.length).toBeGreaterThan(0);
    const mid = wire.midHandles[0];
    expect(mid.dot.fill()).toBe(lightenHex("#dc2626", 0.82));
    expect(mid.dot.stroke()).toBe(lightenHex("#dc2626", 0.28));
    expect(mid.halo.visible()).toBe(false);

    harness.stage.getPointerPosition = function () {
      return { x: mid.x(), y: mid.y() };
    };
    mid.fire("mousedown", {
      evt: { type: "mousedown", preventDefault() {} },
      target: mid,
      currentTarget: mid,
      type: "mousedown",
      cancelBubble: false,
    });
    expect(mid.halo.visible()).toBe(true);
    expect(mid.halo.fill().startsWith("rgba(")).toBe(true);
  });

  it("magnetically connects on drag-drop near a terminal and skips self", () => {
    /** @type {Array<object>} */
    const terminals = [];
    const harness = makeHarness({
      listTerminals: function () {
        return terminals;
      },
      getView: function () {
        return { scale: 1, x: 0, y: 0 };
      },
    });
    terminals.push(harness.a, harness.b);

    // Stub pointer — jsdom/Konva setPointersPositions yields NaN without layout.
    harness.stage.getPointerPosition = function () {
      return { x: 220, y: 40 };
    };
    // Near B (world 200,40) but outside the tiny circle hit — snap should still connect.
    expect(harness.manager.terminalAtPointer(harness.stage, harness.a)).toBe(harness.b);
    harness.manager.completeDragConnect(harness.a, harness.stage, "red");
    expect(harness.manager.getWires()).toHaveLength(1);
    expect(harness.manager.hasWireBetween(harness.a, harness.b)).toBe(true);

    harness.manager.clearWires();
    harness.stage.getPointerPosition = function () {
      return { x: 50, y: 40 };
    };
    // Near A while dragging from A — exclude source, no self-wire.
    expect(harness.manager.terminalAtPointer(harness.stage, harness.a)).toBeNull();
    harness.manager.completeDragConnect(harness.a, harness.stage, "red");
    expect(harness.manager.getWires()).toHaveLength(0);
  });
});
