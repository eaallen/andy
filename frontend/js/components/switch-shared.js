import Konva from "konva";

/**
 * Draws a tinted shell used for SPST toggle switches.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} width - Box width.
 * @param {number} height - Box height.
 * @param {string} title - Title shown at the top of the box.
 */
export function addSwitchShell(group, width, height, title) {
  const rect = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: "#f0fdf4",
    stroke: "#86efac",
    strokeWidth: 2,
    cornerRadius: 8,
    shadowColor: "rgba(22, 163, 74, 0.12)",
    shadowBlur: 10,
    shadowOffsetY: 2,
    name: "component-shell",
  });

  const titleText = new Konva.Text({
    x: 10,
    y: 8,
    text: title,
    fontSize: 13,
    fontFamily: "system-ui, Arial, sans-serif",
    fontStyle: "bold",
    fill: "#166534",
    listening: false,
  });

  group.add(rect);
  group.add(titleText);

  return { width: width, height: height };
}

/**
 * Draws an interactive SPST toggle symbol and stores the actuator for later updates.
 * @param {Konva.Group} group - Parent component group.
 * @param {number} x - Local x of symbol center.
 * @param {number} y - Local y of symbol center.
 * @param {number} width - Symbol width.
 */
export function addSpstToggleSymbol(group, x, y, width) {
  const half = width / 2;
  const contactY = y + 6;
  const hingeX = x - half + 10;
  const openEndX = x + half - 4;
  const openEndY = contactY - 10;
  const closedEndX = x + half - 10;
  const closedEndY = contactY;

  group.add(
    new Konva.Line({
      points: [x - half, contactY, hingeX, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );
  group.add(
    new Konva.Line({
      points: [closedEndX, contactY, x + half, contactY],
      stroke: "#18181b",
      strokeWidth: 2,
      lineCap: "round",
      listening: false,
    })
  );

  const actuator = new Konva.Line({
    points: [hingeX, contactY, openEndX, openEndY],
    stroke: "#18181b",
    strokeWidth: 2,
    lineCap: "round",
    listening: false,
    name: "switch-actuator",
  });
  group.add(actuator);

  group.switchSymbol = {
    actuator: actuator,
    hingeX: hingeX,
    contactY: contactY,
    openEndX: openEndX,
    openEndY: openEndY,
    closedEndX: closedEndX,
    closedEndY: closedEndY,
  };
  return actuator;
}

/**
 * Adds the shared switch hit area and position hint text.
 * @param {Konva.Group} group - Switch component group.
 * @param {number} shellWidth - Shell width.
 * @param {number} hintY - Y position for the hint label.
 * @param {string} hintText - Initial hint text.
 */
export function addSwitchHitAndHint(group, shellWidth, hintY, hintText) {
  const hit = new Konva.Rect({
    x: 8,
    y: 28,
    width: shellWidth - 16,
    height: 36,
    fill: "rgba(0,0,0,0)",
    name: "switch-hit",
  });
  group.add(hit);
  group.switchHit = hit;

  group.add(
    new Konva.Text({
      x: 0,
      y: hintY,
      width: shellWidth,
      align: "center",
      text: hintText,
      fontSize: 10,
      fontFamily: "system-ui, Arial, sans-serif",
      fontStyle: "bold",
      fill: "#15803d",
      listening: false,
      name: "switch-hint",
    })
  );
}

/**
 * Updates a toggle switch symbol and shell for open/closed (or throw) state.
 * SPST: Open / Closed. Three-way: T1 / T2. Four-way: Straight / Cross.
 * @param {Konva.Group} sw - Switch component from a switch factory.
 * @param {{ closed?: boolean }} state - Visual state flags.
 */
export function applySwitchVisual(sw, state) {
  const closed = !!state.closed;
  sw.isClosed = closed;
  sw.isPressed = closed;
  const shell = sw.findOne(".component-shell");
  const symbol = sw.switchSymbol;
  const hint = sw.findOne(".switch-hint");
  const kind = sw.switchKind || "spst";

  if (shell) {
    shell.fill(closed ? "#ecfdf5" : "#f0fdf4");
    shell.stroke(closed ? "#059669" : "#86efac");
  }

  if (symbol && symbol.actuator) {
    if (closed) {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.closedEndX,
        symbol.closedEndY,
      ]);
      symbol.actuator.stroke("#059669");
    } else {
      symbol.actuator.points([
        symbol.hingeX,
        symbol.contactY,
        symbol.openEndX,
        symbol.openEndY,
      ]);
      symbol.actuator.stroke("#18181b");
    }
  }

  if (hint) {
    if (kind === "three-way") {
      hint.text(closed ? "T2" : "T1");
    } else if (kind === "four-way") {
      hint.text(closed ? "Cross" : "Straight");
    } else {
      hint.text(closed ? "Closed" : "Open");
    }
    hint.fill(closed ? "#047857" : "#15803d");
  }
}
