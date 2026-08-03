import { afterEach, describe, expect, it } from "vitest";
import Konva from "konva";
import {
  TERMINAL_HIGHLIGHT_HALO_RADIUS,
  TERMINAL_HIGHLIGHT_HALO_RADIUS_TOUCH,
  addTerminal,
  setTerminalHighlightVisual,
} from "../js/components/shared.js";
import { isTouchPointerEvent } from "../js/terminal-snap.js";

describe("setTerminalHighlightVisual", () => {
  /** @type {Konva.Stage[]} */
  const stages = [];

  afterEach(() => {
    while (stages.length > 0) {
      const stage = stages.pop();
      stage.destroy();
    }
  });

  /**
   * Builds a component group with one terminal for highlight tests.
   */
  function makeTerminal() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const stage = new Konva.Stage({
      container: container,
      width: 200,
      height: 200,
    });
    stages.push(stage);
    const layer = new Konva.Layer();
    stage.add(layer);
    const group = new Konva.Group({ x: 20, y: 20 });
    layer.add(group);
    const terminal = addTerminal(group, 40, 0, "hot", "Hot", {
      side: "top",
      shellWidth: 100,
      shellHeight: 80,
    });
    stage.draw();
    return terminal;
  }

  it("shows a large halo and emphasizes the label while active", () => {
    const terminal = makeTerminal();
    expect(terminal.halo.visible()).toBe(false);

    setTerminalHighlightVisual(terminal, true);
    expect(terminal.halo.visible()).toBe(true);
    expect(terminal.halo.radius()).toBe(TERMINAL_HIGHLIGHT_HALO_RADIUS);
    expect(terminal.node.stroke()).toBe("#2563eb");
    expect(terminal.node.fill()).toBe("#dbeafe");
    expect(terminal.labelNode.fill()).toBe("#1d4ed8");
    expect(terminal.labelNode.fontSize()).toBe(13);

    setTerminalHighlightVisual(terminal, false);
    expect(terminal.halo.visible()).toBe(false);
    expect(terminal.node.stroke()).toBe("#000000");
    expect(terminal.node.fill()).toBe("#ffffff");
    expect(terminal.labelNode.fill()).toBe("#3f3f46");
    expect(terminal.labelNode.fontSize()).toBe(11);
  });

  it("uses a larger halo for touch presses", () => {
    const terminal = makeTerminal();
    setTerminalHighlightVisual(terminal, true, { touch: true });
    expect(terminal.halo.radius()).toBe(TERMINAL_HIGHLIGHT_HALO_RADIUS_TOUCH);
  });

  it("scales the halo so screen size stays stable when zoomed out", () => {
    const terminal = makeTerminal();
    setTerminalHighlightVisual(terminal, true, { viewScale: 0.5 });
    expect(terminal.halo.radius()).toBe(TERMINAL_HIGHLIGHT_HALO_RADIUS / 0.5);
  });
});

describe("isTouchPointerEvent", () => {
  it("detects touch events from Konva wrappers and native events", () => {
    expect(isTouchPointerEvent({ type: "touchstart" })).toBe(true);
    expect(isTouchPointerEvent({ evt: { type: "touchend" } })).toBe(true);
    expect(isTouchPointerEvent({ type: "mousedown" })).toBe(false);
    expect(isTouchPointerEvent(null)).toBe(false);
  });
});
