import { describe, expect, it, afterEach } from "vitest";
import Konva from "konva";
import {
  absoluteToLocal,
  getTerminalPosition,
} from "../js/components/shared.js";

describe("terminal positions under stage pan/zoom", () => {
  /** @type {Konva.Stage[]} */
  const stages = [];

  afterEach(() => {
    while (stages.length > 0) {
      const stage = stages.pop();
      stage.destroy();
    }
  });

  /**
   * Builds a tiny stage with a terminal-like group at a known world point.
   * @param {{ scale?: number; x?: number; y?: number }} view - Stage camera.
   */
  function makeStageWithTerminal(view) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const stage = new Konva.Stage({
      container: container,
      width: 400,
      height: 300,
    });
    stages.push(stage);
    stage.scale({ x: view.scale || 1, y: view.scale || 1 });
    stage.position({ x: view.x || 0, y: view.y || 0 });

    const layer = new Konva.Layer();
    stage.add(layer);
    const handle = new Konva.Group({ x: 120, y: 80 });
    handle.add(new Konva.Circle({ x: 0, y: 0, radius: 6 }));
    layer.add(handle);
    stage.draw();

    return {
      stage: stage,
      layer: layer,
      terminal: { handle: handle, node: handle.findOne("Circle") },
      container: container,
    };
  }

  it("absoluteToLocal undoes the stage camera so world coords stay stable", () => {
    const { stage, terminal } = makeStageWithTerminal({
      scale: 2,
      x: 40,
      y: -10,
    });
    const abs = terminal.handle.getAbsolutePosition();
    const local = absoluteToLocal(abs, stage);
    expect(local.x).toBeCloseTo(120, 5);
    expect(local.y).toBeCloseTo(80, 5);
  });

  it("getTerminalPosition anchors to the wire layer under pan/zoom", () => {
    const { layer, terminal } = makeStageWithTerminal({
      scale: 1.5,
      x: -30,
      y: 20,
    });
    const pos = getTerminalPosition(terminal, layer);
    expect(pos.x).toBeCloseTo(120, 5);
    expect(pos.y).toBeCloseTo(80, 5);
  });

  it("getTerminalPosition matches layer space at identity transform", () => {
    const { layer, terminal } = makeStageWithTerminal({ scale: 1, x: 0, y: 0 });
    const pos = getTerminalPosition(terminal, layer);
    expect(pos.x).toBeCloseTo(120, 5);
    expect(pos.y).toBeCloseTo(80, 5);
  });
});
