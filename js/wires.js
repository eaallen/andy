import Konva from "https://esm.sh/konva@9";
import { WIRE_COLORS, getTerminalPosition, getTerminalComponentGroup } from "./components.js";

/** Dash patterns for same-color wires (first is solid). */
const WIRE_DASH_PATTERNS = [
  [],
  [14, 8],
  [3, 6],
  [14, 6, 3, 6],
  [14, 6, 3, 6, 3, 6],
  [8, 5],
  [3, 6, 3, 6, 14, 6],
  [2, 5],
];

/**
 * Manages terminal-to-terminal wires on a Konva layer, with bend points and undo.
 * @param {Konva.Layer} layer - Layer that holds wire lines.
 * @param {{ onChange?: () => void, onHistoryChange?: (canUndo: boolean) => void, resolveTerminal?: (key: string) => object|null }} [options] - Manager options.
 */
export function createWireManager(layer, options) {
  const opts = typeof options === "function" ? { onChange: options } : options || {};
  const onChange = opts.onChange;
  const onHistoryChange = opts.onHistoryChange;
  const resolveTerminal = opts.resolveTerminal;

  const wires = [];
  const history = [];
  const MAX_HISTORY = 50;
  let selectedWire = null;
  let pendingTerminal = null;
  let restoring = false;

  /**
   * Notifies listeners that the wire list changed.
   */
  function notifyChange() {
    if (typeof onChange === "function") {
      onChange();
    }
  }

  /**
   * Notifies listeners that undo availability changed.
   */
  function notifyHistoryChange() {
    if (typeof onHistoryChange === "function") {
      onHistoryChange(history.length > 0);
    }
  }

  /**
   * Builds a stable key for a terminal (component id + terminal id).
   * @param {{ node: Konva.Circle, id: string, componentGroup?: Konva.Group }} terminal - Terminal metadata.
   */
  function terminalKey(terminal) {
    const group = getTerminalComponentGroup(terminal);
    return (group && group.componentId ? group.componentId : "unknown") + ":" + terminal.id;
  }

  /**
   * Serializes the current wire list for undo.
   */
  function captureSnapshot() {
    const snapshot = [];
    for (let i = 0; i < wires.length; i += 1) {
      const wire = wires[i];
      const bends = [];
      for (let b = 0; b < wire.bends.length; b += 1) {
        bends.push({ x: wire.bends[b].x, y: wire.bends[b].y });
      }
      snapshot.push({
        fromKey: terminalKey(wire.from),
        toKey: terminalKey(wire.to),
        colorKey: wire.colorKey,
        bends: bends,
        selectable: wire.selectable !== false,
      });
    }
    return snapshot;
  }

  /**
   * Pushes the current wire state onto the undo stack.
   */
  function pushHistory() {
    if (restoring) {
      return;
    }
    history.push(captureSnapshot());
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    notifyHistoryChange();
  }

  /**
   * Clears the undo stack (e.g. after a mode rebuild).
   */
  function clearHistory() {
    history.length = 0;
    notifyHistoryChange();
  }

  /**
   * Returns a copy of the undo stack for persistence.
   */
  function exportHistory() {
    const copy = [];
    for (let i = 0; i < history.length; i += 1) {
      copy.push(cloneSnapshot(history[i]));
    }
    return copy;
  }

  /**
   * Replaces the undo stack (e.g. when restoring Lab mode).
   * @param {Array<object>} snapshots - Previously exported history entries.
   */
  function importHistory(snapshots) {
    history.length = 0;
    if (snapshots) {
      for (let i = 0; i < snapshots.length; i += 1) {
        history.push(cloneSnapshot(snapshots[i]));
      }
    }
    notifyHistoryChange();
  }

  /**
   * Deep-copies a wire snapshot array.
   * @param {Array<object>} snapshot - Snapshot to clone.
   */
  function cloneSnapshot(snapshot) {
    const copy = [];
    for (let i = 0; i < snapshot.length; i += 1) {
      const entry = snapshot[i];
      const bends = [];
      for (let b = 0; b < entry.bends.length; b += 1) {
        bends.push({ x: entry.bends[b].x, y: entry.bends[b].y });
      }
      copy.push({
        fromKey: entry.fromKey,
        toKey: entry.toKey,
        colorKey: entry.colorKey,
        bends: bends,
        selectable: entry.selectable !== false,
      });
    }
    return copy;
  }

  /**
   * Exports the current wires as a snapshot for persistence.
   */
  function exportSnapshot() {
    return cloneSnapshot(captureSnapshot());
  }

  /**
   * Replaces all wires with a snapshot (no undo entry).
   * @param {Array<object>} snapshot - Serialized wire list.
   */
  function importSnapshot(snapshot) {
    restoreSnapshot(snapshot || []);
  }

  /**
   * Returns whether an undo step is available.
   */
  function canUndo() {
    return history.length > 0;
  }

  /**
   * Clears pending terminal selection highlight.
   */
  function clearPendingHighlight() {
    if (pendingTerminal && pendingTerminal.node) {
      pendingTerminal.node.stroke("#ffffff");
      pendingTerminal.node.strokeWidth(2);
    }
    pendingTerminal = null;
  }

  /**
   * Highlights a terminal as the first endpoint of a new wire.
   * @param {{ node: Konva.Circle }} terminal - Terminal to highlight.
   */
  function setPendingTerminal(terminal) {
    clearPendingHighlight();
    pendingTerminal = terminal;
    terminal.node.stroke("#2563eb");
    terminal.node.strokeWidth(3);
  }

  /**
   * Builds the flat points array for a wire from terminals and bends.
   * @param {object} wire - Wire record.
   */
  function buildPoints(wire) {
    const fromPos = getTerminalPosition(wire.from);
    const toPos = getTerminalPosition(wire.to);
    const points = [fromPos.x, fromPos.y];
    for (let i = 0; i < wire.bends.length; i += 1) {
      points.push(wire.bends[i].x, wire.bends[i].y);
    }
    points.push(toPos.x, toPos.y);
    return points;
  }

  /**
   * Applies current geometry to the Konva line.
   * @param {object} wire - Wire record.
   */
  function refreshWireGeometry(wire) {
    wire.line.points(buildPoints(wire));
  }

  /**
   * Returns the dash array for a pattern index (cycles if more wires than patterns).
   * @param {number} patternIndex - Index into WIRE_DASH_PATTERNS.
   */
  function dashForPatternIndex(patternIndex) {
    const index = ((patternIndex % WIRE_DASH_PATTERNS.length) + WIRE_DASH_PATTERNS.length) % WIRE_DASH_PATTERNS.length;
    return WIRE_DASH_PATTERNS[index].slice();
  }

  /**
   * Applies the wire's color-pattern dash to its Konva line.
   * @param {object} wire - Wire record.
   */
  function applyWireDash(wire) {
    if (!wire.line) {
      return;
    }
    wire.line.dash(dashForPatternIndex(wire.patternIndex || 0));
  }

  /**
   * Counts how many wires already use a given color.
   * @param {string} colorKey - Wire color key.
   */
  function countWiresWithColor(colorKey) {
    let count = 0;
    for (let i = 0; i < wires.length; i += 1) {
      if (wires[i].colorKey === colorKey) {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Reassigns dash patterns for all wires of a color (first solid, then dashes/dots).
   * @param {string} colorKey - Wire color key.
   */
  function reassignPatternsForColor(colorKey) {
    let index = 0;
    for (let i = 0; i < wires.length; i += 1) {
      const wire = wires[i];
      if (wire.colorKey !== colorKey) {
        continue;
      }
      wire.patternIndex = index;
      applyWireDash(wire);
      index += 1;
    }
  }

  /**
   * Hides and destroys bend handle circles for a wire.
   * @param {object} wire - Wire record.
   */
  function destroyBendHandles(wire) {
    if (!wire.handles) {
      return;
    }
    for (let i = 0; i < wire.handles.length; i += 1) {
      wire.handles[i].destroy();
    }
    wire.handles = [];
  }

  /**
   * Shows draggable bend handles for the selected wire.
   * @param {object} wire - Wire record.
   */
  function showBendHandles(wire) {
    destroyBendHandles(wire);
    wire.handles = [];

    for (let i = 0; i < wire.bends.length; i += 1) {
      (function (bendIndex) {
        const bend = wire.bends[bendIndex];
        const handle = new Konva.Circle({
          x: bend.x,
          y: bend.y,
          radius: 6,
          fill: "#ffffff",
          stroke: "#2563eb",
          strokeWidth: 2,
          draggable: true,
          name: "bend-handle",
        });

        handle.on("dragstart", function () {
          pushHistory();
        });

        handle.on("dragmove", function () {
          wire.bends[bendIndex].x = handle.x();
          wire.bends[bendIndex].y = handle.y();
          refreshWireGeometry(wire);
          layer.batchDraw();
        });

        handle.on("click tap", function (evt) {
          evt.cancelBubble = true;
          selectWire(wire);
        });

        handle.on("dblclick dbltap", function (evt) {
          evt.cancelBubble = true;
          removeBend(wire, bendIndex);
        });

        layer.add(handle);
        wire.handles.push(handle);
      })(i);
    }

    layer.batchDraw();
  }

  /**
   * Deselects the currently selected wire, if any.
   */
  function clearWireSelection() {
    if (selectedWire) {
      selectedWire.line.strokeWidth(3);
      applyWireDash(selectedWire);
      destroyBendHandles(selectedWire);
      selectedWire = null;
    }
  }

  /**
   * Selects a wire for editing bends or deletion.
   * @param {object} wire - Wire record from the manager.
   */
  function selectWire(wire) {
    clearWireSelection();
    selectedWire = wire;
    wire.line.strokeWidth(5);
    showBendHandles(wire);
    layer.batchDraw();
  }

  /**
   * Squared distance from a point to a line segment.
   * @param {number} px - Point x.
   * @param {number} py - Point y.
   * @param {number} x1 - Segment start x.
   * @param {number} y1 - Segment start y.
   * @param {number} x2 - Segment end x.
   * @param {number} y2 - Segment end y.
   */
  function distToSegmentSq(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      const ex = px - x1;
      const ey = py - y1;
      return ex * ex + ey * ey;
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const ex = px - projX;
    const ey = py - projY;
    return ex * ex + ey * ey;
  }

  /**
   * Finds which polyline segment is closest to a stage point.
   * @param {object} wire - Wire record.
   * @param {number} x - Stage x.
   * @param {number} y - Stage y.
   */
  function findClosestSegmentIndex(wire, x, y) {
    const points = buildPoints(wire);
    let bestIndex = 0;
    let bestDist = Infinity;

    for (let i = 0; i < points.length - 2; i += 2) {
      const dist = distToSegmentSq(
        x,
        y,
        points[i],
        points[i + 1],
        points[i + 2],
        points[i + 3]
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i / 2;
      }
    }

    return bestIndex;
  }

  /**
   * Adds a bend point on a wire near the given stage position.
   * @param {object} wire - Wire record.
   * @param {number} x - Stage x of the new bend.
   * @param {number} y - Stage y of the new bend.
   */
  function addBend(wire, x, y) {
    pushHistory();
    const segmentIndex = findClosestSegmentIndex(wire, x, y);
    const bendInsertAt = Math.max(0, segmentIndex);
    wire.bends.splice(bendInsertAt, 0, { x: x, y: y });
    refreshWireGeometry(wire);
    selectWire(wire);
    notifyChange();
  }

  /**
   * Removes a bend point from a wire.
   * @param {object} wire - Wire record.
   * @param {number} bendIndex - Index in wire.bends.
   */
  function removeBend(wire, bendIndex) {
    if (bendIndex < 0 || bendIndex >= wire.bends.length) {
      return;
    }
    pushHistory();
    wire.bends.splice(bendIndex, 1);
    refreshWireGeometry(wire);
    if (selectedWire === wire) {
      showBendHandles(wire);
    }
    notifyChange();
    layer.batchDraw();
  }

  /**
   * Recomputes line endpoints from current terminal positions (bends stay put).
   */
  function updateWirePositions() {
    for (let i = 0; i < wires.length; i += 1) {
      const wire = wires[i];
      refreshWireGeometry(wire);
      if (wire.handles && wire.handles.length > 0) {
        for (let h = 0; h < wire.handles.length; h += 1) {
          wire.handles[h].position(wire.bends[h]);
        }
      }
    }
    layer.batchDraw();
  }

  /**
   * Creates a wire between two terminals.
   * @param {{ node: Konva.Circle }} from - First terminal.
   * @param {{ node: Konva.Circle }} to - Second terminal.
   * @param {string} colorKey - Key in WIRE_COLORS (red, gray, blue, green).
   * @param {{ selectable?: boolean, bends?: Array<{x: number, y: number}>, recordHistory?: boolean }} [wireOpts] - Wire options.
   */
  function addWire(from, to, colorKey, wireOpts) {
    const options = wireOpts || {};
    const selectable = options.selectable !== false;
    const recordHistory = options.recordHistory !== false && !restoring;
    const stroke = WIRE_COLORS[colorKey] || WIRE_COLORS.red;
    const bends = [];
    if (options.bends) {
      for (let i = 0; i < options.bends.length; i += 1) {
        bends.push({ x: options.bends[i].x, y: options.bends[i].y });
      }
    }

    if (recordHistory) {
      pushHistory();
    }

    const patternIndex = countWiresWithColor(colorKey);
    const wire = {
      id: "wire-" + wires.length + "-" + Date.now(),
      from: from,
      to: to,
      colorKey: colorKey,
      patternIndex: patternIndex,
      bends: bends,
      handles: [],
      selectable: selectable,
      line: null,
    };

    const line = new Konva.Line({
      points: buildPoints(wire),
      stroke: stroke,
      strokeWidth: 3,
      dash: dashForPatternIndex(patternIndex),
      lineCap: "round",
      lineJoin: "round",
      hitStrokeWidth: 16,
      listening: true,
    });
    wire.line = line;

    line.on("click tap", function (evt) {
      evt.cancelBubble = true;
      selectWire(wire);
    });

    line.on("dblclick dbltap", function (evt) {
      evt.cancelBubble = true;
      const pos = layer.getRelativePointerPosition();
      if (!pos) {
        return;
      }
      addBend(wire, pos.x, pos.y);
    });

    layer.add(line);
    line.moveToBottom();
    wires.push(wire);
    notifyChange();
    layer.batchDraw();
    return wire;
  }

  /**
   * Removes a wire from the layer and list.
   * @param {object} wire - Wire record to remove.
   * @param {{ recordHistory?: boolean }} [removeOpts] - Remove options.
   */
  function removeWire(wire, removeOpts) {
    const index = wires.indexOf(wire);
    if (index === -1) {
      return;
    }
    const options = removeOpts || {};
    if (options.recordHistory !== false && !restoring) {
      pushHistory();
    }
    const colorKey = wire.colorKey;
    destroyBendHandles(wire);
    wire.line.destroy();
    wires.splice(index, 1);
    if (selectedWire === wire) {
      selectedWire = null;
    }
    reassignPatternsForColor(colorKey);
    notifyChange();
    layer.batchDraw();
  }

  /**
   * Removes the currently selected wire.
   */
  function removeSelectedWire() {
    if (!selectedWire) {
      return false;
    }
    if (selectedWire.selectable === false) {
      return false;
    }
    removeWire(selectedWire);
    return true;
  }

  /**
   * Removes every wire without recording undo (used for mode rebuilds).
   */
  function clearWires() {
    clearPendingHighlight();
    clearWireSelection();
    while (wires.length > 0) {
      const wire = wires.pop();
      destroyBendHandles(wire);
      wire.line.destroy();
    }
    notifyChange();
    layer.batchDraw();
  }

  /**
   * Restores wires from a snapshot.
   * @param {Array<object>} snapshot - Serialized wire list.
   */
  function restoreSnapshot(snapshot) {
    if (typeof resolveTerminal !== "function") {
      return;
    }

    restoring = true;
    clearWires();

    for (let i = 0; i < snapshot.length; i += 1) {
      const entry = snapshot[i];
      const from = resolveTerminal(entry.fromKey);
      const to = resolveTerminal(entry.toKey);
      if (!from || !to) {
        continue;
      }
      addWire(from, to, entry.colorKey, {
        selectable: entry.selectable,
        bends: entry.bends,
        recordHistory: false,
      });
    }

    restoring = false;
    notifyChange();
    layer.batchDraw();
  }

  /**
   * Undoes the last wire edit.
   */
  function undo() {
    if (history.length === 0) {
      return false;
    }
    const previous = history.pop();
    notifyHistoryChange();
    clearWireSelection();
    clearPendingHighlight();
    restoreSnapshot(previous);
    return true;
  }

  /**
   * Returns whether a first terminal is already selected for wiring.
   */
  function hasPendingTerminal() {
    return !!pendingTerminal;
  }

  /**
   * Handles a terminal click for wire drawing in Lab mode.
   * @param {{ node: Konva.Circle }} terminal - Clicked terminal.
   * @param {string} colorKey - Active wire color key.
   * @param {boolean} enabled - Whether wire drawing is allowed.
   */
  function handleTerminalClick(terminal, colorKey, enabled) {
    if (!enabled) {
      return;
    }

    if (!pendingTerminal) {
      setPendingTerminal(terminal);
      layer.batchDraw();
      return;
    }

    if (terminalKey(pendingTerminal) === terminalKey(terminal)) {
      clearPendingHighlight();
      layer.batchDraw();
      return;
    }

    addWire(pendingTerminal, terminal, colorKey, { selectable: true });
    clearPendingHighlight();
    layer.batchDraw();
  }

  /**
   * Returns a shallow copy of the current wire list.
   */
  function getWires() {
    return wires.slice();
  }

  return {
    addWire: addWire,
    removeWire: removeWire,
    removeSelectedWire: removeSelectedWire,
    clearWires: clearWires,
    clearPendingHighlight: clearPendingHighlight,
    clearWireSelection: clearWireSelection,
    updateWirePositions: updateWirePositions,
    handleTerminalClick: handleTerminalClick,
    getWires: getWires,
    terminalKey: terminalKey,
    hasPendingTerminal: hasPendingTerminal,
    undo: undo,
    canUndo: canUndo,
    clearHistory: clearHistory,
    exportHistory: exportHistory,
    importHistory: importHistory,
    exportSnapshot: exportSnapshot,
    importSnapshot: importSnapshot,
  };
}
