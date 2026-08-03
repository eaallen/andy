import Konva from "konva";
import { STAGE_DEFAULT_CURSOR } from "./canvas-nav.js";
import { WIRE_COLORS } from "./components/constants.js";
import { getTerminalComponentGroup, getTerminalPosition, setTerminalHighlightVisual } from "./components/shared.js";
import {
  TERMINAL_SNAP_SCREEN_RADIUS,
  isTouchPointerEvent,
  nearestTerminalInScreenRadius,
  wireDragThresholdForEvent,
} from "./terminal-snap.js";
import {
  WIRE_TENSION,
  findClosestSegmentIndex,
  wireSegmentMidpoints,
} from "./wire-path.js";

export {
  WIRE_DRAG_THRESHOLD,
  WIRE_DRAG_THRESHOLD_TOUCH,
  wireDragThresholdForEvent,
} from "./terminal-snap.js";

/** Colored stroke width for an unselected wire. */
const WIRE_STROKE_WIDTH = 3;
/** Colored stroke width for the selected wire. */
const WIRE_STROKE_WIDTH_SELECTED = 5;
/** Extra width added under the colored stroke so crossings stay readable. */
const WIRE_UNDERSTROKE_PAD = 5;
/** Matches `.lab-stage-wrap` background so the halo looks like a canvas cutout. */
const WIRE_UNDERSTROKE_COLOR = "#e8e8e8";
/** Radius of bend handles on a selected wire. */
const BEND_HANDLE_RADIUS = 6;
/** Invisible hit expansion for bend / midpoint handles (finger-friendly). */
const BEND_HANDLE_HIT_STROKE = 22;

/**
 * Shows a crosshair over bend / midpoint handles.
 * @param {Konva.Node} handle - Bend or midpoint handle node.
 */
function bindBendHandleCursor(handle) {
  handle.on("mouseenter", function () {
    const stage = handle.getStage();
    if (stage) {
      stage.container().style.cursor = "crosshair";
    }
  });
  handle.on("mouseleave", function () {
    const stage = handle.getStage();
    if (stage) {
      stage.container().style.cursor = STAGE_DEFAULT_CURSOR;
    }
  });
}

/**
 * Manages terminal-to-terminal wires on a Konva layer, with bend points and undo.
 * @param {Konva.Layer} layer - Layer that holds wire lines.
 * @param {{
 *   onChange?: () => void,
 *   onHistoryChange?: (canUndo: boolean) => void,
 *   onSelectionChange?: (wire: object|null, worldPos: {x:number,y:number}|null) => void,
 *   resolveTerminal?: (key: string) => object|null,
 *   findTerminalFromNode?: (node: Konva.Node) => object|null,
 *   listTerminals?: () => Array<object>,
 *   getView?: () => { scale: number; x: number; y: number },
 * }} [options] - Manager options.
 */
export function createWireManager(layer, options) {
  const opts = typeof options === "function" ? { onChange: options } : options || {};
  const onChange = opts.onChange;
  const onHistoryChange = opts.onHistoryChange;
  const onSelectionChange = opts.onSelectionChange;
  const resolveTerminal = opts.resolveTerminal;
  const findTerminalFromNode = opts.findTerminalFromNode;
  const listTerminals = opts.listTerminals;
  const getView = opts.getView;

  const wires = [];
  const history = [];
  const MAX_HISTORY = 50;
  let selectedWire = null;
  let pendingTerminal = null;
  let snapTerminal = null;
  let pressTerminal = null;
  /** @type {{ touch?: boolean }} */
  let highlightOptions = {};
  let restoring = false;
  /** @type {Konva.Line|null} */
  let draftLine = null;

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
   * Notifies listeners that the selected wire changed.
   * @param {object|null} wire - Selected wire, or null.
   * @param {{ x: number; y: number }|null} [worldPos] - Menu anchor in layer space.
   */
  function notifySelectionChange(wire, worldPos) {
    if (typeof onSelectionChange === "function") {
      onSelectionChange(wire, worldPos || null);
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
   * Returns whether two terminals are already connected.
   * @param {object} a - First terminal.
   * @param {object} b - Second terminal.
   */
  function hasWireBetween(a, b) {
    const keyA = terminalKey(a);
    const keyB = terminalKey(b);
    for (let i = 0; i < wires.length; i += 1) {
      const fromKey = terminalKey(wires[i].from);
      const toKey = terminalKey(wires[i].to);
      if (
        (fromKey === keyA && toKey === keyB) ||
        (fromKey === keyB && toKey === keyA)
      ) {
        return true;
      }
    }
    return false;
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
   * Applies or clears the blue connect highlight on a terminal circle.
   * @param {{ node?: Konva.Circle }|null} terminal - Terminal metadata.
   * @param {boolean} on - Whether the highlight is active.
   */
  function applyTerminalHighlight(terminal, on) {
    const view = typeof getView === "function" ? getView() : null;
    const viewScale = view && typeof view.scale === "number" ? view.scale : 1;
    setTerminalHighlightVisual(terminal, on, {
      touch: !!highlightOptions.touch,
      viewScale: viewScale,
    });
    if (!terminal || !terminal.node) {
      return;
    }
    const termLayer = terminal.node.getLayer();
    if (termLayer) {
      termLayer.batchDraw();
    }
  }

  /**
   * Returns whether a terminal is currently kept highlighted by pending or snap.
   * @param {object|null} terminal - Terminal to check.
   */
  function isStickyHighlight(terminal) {
    return !!terminal && (terminal === pendingTerminal || terminal === snapTerminal);
  }

  /**
   * Clears the in-gesture press highlight without touching pending/snap.
   */
  function clearPressHighlight() {
    if (pressTerminal && !isStickyHighlight(pressTerminal)) {
      applyTerminalHighlight(pressTerminal, false);
    }
    pressTerminal = null;
  }

  /**
   * Shows a large press halo immediately on pointer-down (before tap completes).
   * @param {{ node: Konva.Circle }|null} terminal - Terminal under the finger.
   * @param {Konva.KonvaEventObject|Event|null|undefined} [evt] - Gesture event (touch → larger halo).
   */
  function setPressHighlight(terminal, evt) {
    highlightOptions = { touch: isTouchPointerEvent(evt) };
    if (pressTerminal === terminal) {
      if (terminal) {
        applyTerminalHighlight(terminal, true);
      }
      return;
    }
    clearPressHighlight();
    pressTerminal = terminal || null;
    if (pressTerminal) {
      applyTerminalHighlight(pressTerminal, true);
    }
  }

  /**
   * Clears the rubber-band snap-target highlight.
   */
  function clearSnapHighlight() {
    if (snapTerminal && snapTerminal !== pendingTerminal && snapTerminal !== pressTerminal) {
      applyTerminalHighlight(snapTerminal, false);
    }
    snapTerminal = null;
  }

  /**
   * Highlights the terminal under the pointer during a rubber-band drag.
   * @param {object|null} terminal - Snap target, or null to clear.
   */
  function setSnapHighlight(terminal) {
    if (snapTerminal === terminal) {
      return;
    }
    clearSnapHighlight();
    if (!terminal || terminal === pendingTerminal) {
      return;
    }
    snapTerminal = terminal;
    applyTerminalHighlight(terminal, true);
  }

  /**
   * Clears pending terminal selection highlight.
   */
  function clearPendingHighlight() {
    clearSnapHighlight();
    clearPressHighlight();
    if (pendingTerminal) {
      applyTerminalHighlight(pendingTerminal, false);
    }
    pendingTerminal = null;
    clearDraft();
  }

  /**
   * Highlights a terminal as the first endpoint of a new wire.
   * @param {{ node: Konva.Circle }} terminal - Terminal to highlight.
   */
  function setPendingTerminal(terminal) {
    // Promote an in-gesture press on the same node without a clear/redraw flicker.
    if (pressTerminal === terminal) {
      pressTerminal = null;
    }
    clearPendingHighlight();
    pendingTerminal = terminal;
    applyTerminalHighlight(terminal, true);
  }

  /**
   * Builds vertex list for a wire in layer space.
   * @param {object} wire - Wire record.
   */
  function wireVertices(wire) {
    const fromPos = getTerminalPosition(wire.from, layer);
    const toPos = getTerminalPosition(wire.to, layer);
    return [fromPos].concat(wire.bends, [toPos]);
  }

  /**
   * Builds the flat points array for a wire from terminals and bends.
   * @param {object} wire - Wire record.
   */
  function buildPoints(wire) {
    const verts = wireVertices(wire);
    const points = [];
    for (let i = 0; i < verts.length; i += 1) {
      points.push(verts[i].x, verts[i].y);
    }
    return points;
  }

  /**
   * Applies current geometry to the Konva line (and understroke).
   * @param {object} wire - Wire record.
   */
  function refreshWireGeometry(wire) {
    const points = buildPoints(wire);
    wire.line.points(points);
    if (wire.understroke) {
      wire.understroke.points(points);
    }
  }

  /**
   * Applies stroke color and selected width to a wire's lines.
   * @param {object} wire - Wire record.
   * @param {boolean} selected - Whether the wire is selected.
   */
  function applyWireStroke(wire, selected) {
    const stroke = WIRE_COLORS[wire.colorKey] || WIRE_COLORS.black;
    const width = selected ? WIRE_STROKE_WIDTH_SELECTED : WIRE_STROKE_WIDTH;
    wire.line.stroke(stroke);
    wire.line.strokeWidth(width);
    if (wire.understroke) {
      wire.understroke.strokeWidth(width + WIRE_UNDERSTROKE_PAD);
    }
  }

  /**
   * Removes the rubber-band draft line if present.
   */
  function clearDraft() {
    if (draftLine) {
      draftLine.destroy();
      draftLine = null;
      layer.batchDraw();
    }
  }

  /**
   * Shows or updates the ethereal rubber-band from a terminal to a pointer.
   * @param {object} fromTerminal - Start terminal.
   * @param {{ x: number; y: number }} pointer - Layer-space pointer.
   */
  function setDraftDrag(fromTerminal, pointer) {
    const fromPos = getTerminalPosition(fromTerminal, layer);
    const points = [fromPos.x, fromPos.y, pointer.x, pointer.y];
    if (!draftLine) {
      draftLine = new Konva.Line({
        points: points,
        stroke: "#c4b5fd",
        strokeWidth: 2,
        dash: [4, 10],
        opacity: 0.7,
        lineCap: "round",
        shadowColor: "#a78bfa",
        shadowBlur: 18,
        shadowOpacity: 0.95,
        listening: false,
        name: "wire-draft",
      });
      layer.add(draftLine);
    } else {
      draftLine.points(points);
    }
    draftLine.moveToTop();
    layer.batchDraw();
  }

  /**
   * Hides and destroys bend / midpoint handles for a wire.
   * @param {object} wire - Wire record.
   */
  function destroyBendHandles(wire) {
    if (wire.handles) {
      for (let i = 0; i < wire.handles.length; i += 1) {
        wire.handles[i].destroy();
      }
    }
    if (wire.midHandles) {
      for (let i = 0; i < wire.midHandles.length; i += 1) {
        wire.midHandles[i].destroy();
      }
    }
    wire.handles = [];
    wire.midHandles = [];
  }

  /**
   * Destroys only midpoint handles (keeps bend handles during a bend drag).
   * @param {object} wire - Wire record.
   */
  function destroyMidHandles(wire) {
    if (wire.midHandles) {
      for (let i = 0; i < wire.midHandles.length; i += 1) {
        wire.midHandles[i].destroy();
      }
    }
    wire.midHandles = [];
  }

  /**
   * Rebuilds midpoint handles to follow the current tensioned path.
   * @param {object} wire - Wire record.
   */
  function refreshMidpointHandles(wire) {
    destroyMidHandles(wire);
    wire.midHandles = [];
    const verts = wireVertices(wire);
    const mids = wireSegmentMidpoints(verts, WIRE_TENSION);
    for (let i = 0; i < mids.length; i += 1) {
      (function (segmentIndex) {
        const mid = mids[segmentIndex];
        const handle = new Konva.Circle({
          x: mid.x,
          y: mid.y,
          radius: BEND_HANDLE_RADIUS - 1,
          fill: "#dbeafe",
          stroke: "#93c5fd",
          strokeWidth: 1.5,
          hitStrokeWidth: BEND_HANDLE_HIT_STROKE,
          opacity: 0.9,
          name: "bend-midpoint",
        });
        handle.on("mousedown touchstart", function (evt) {
          beginMidpointDrag(wire, segmentIndex, evt);
        });
        handle.on("click tap", function (evt) {
          evt.cancelBubble = true;
        });
        bindBendHandleCursor(handle);
        layer.add(handle);
        wire.midHandles.push(handle);
      })(i);
    }
  }

  /**
   * Starts a mid-segment drag that inserts a bend after a short move.
   * @param {object} wire - Wire record.
   * @param {number} segmentIndex - Segment index for the new bend.
   * @param {Konva.KonvaEventObject} e - Pointer down event.
   */
  function beginMidpointDrag(wire, segmentIndex, e) {
    e.cancelBubble = true;
    if (e.evt && e.evt.preventDefault) {
      e.evt.preventDefault();
    }
    const stage = layer.getStage();
    if (!stage) {
      return;
    }
    const startPointer = stage.getPointerPosition();
    if (!startPointer) {
      return;
    }
    const start = { x: startPointer.x, y: startPointer.y };
    const dragThreshold = wireDragThresholdForEvent(e);
    let inserted = false;
    const bendIndex = segmentIndex;

    /**
     * Inserts the bend once the pointer moves, then updates its position.
     * @param {Konva.KonvaEventObject} evt - Move event.
     */
    function onMove(evt) {
      evt.evt.preventDefault();
      const pos = layer.getRelativePointerPosition();
      const stagePos = stage.getPointerPosition();
      if (!pos || !stagePos) {
        return;
      }
      if (!inserted) {
        const dx = stagePos.x - start.x;
        const dy = stagePos.y - start.y;
        if (dx * dx + dy * dy < dragThreshold * dragThreshold) {
          return;
        }
        inserted = true;
        pushHistory();
        wire.bends.splice(bendIndex, 0, { x: pos.x, y: pos.y });
        refreshWireGeometry(wire);
        // Rebuild bend handles once; hide midpoints until pointer up.
        destroyBendHandles(wire);
        wire.handles = [];
        wire.midHandles = [];
        for (let i = 0; i < wire.bends.length; i += 1) {
          (function (index) {
            const bend = wire.bends[index];
            const handle = new Konva.Circle({
              x: bend.x,
              y: bend.y,
              radius: BEND_HANDLE_RADIUS,
              fill: "#ffffff",
              stroke: "#2563eb",
              strokeWidth: 2,
              hitStrokeWidth: BEND_HANDLE_HIT_STROKE,
              name: "bend-handle",
            });
            bindBendHandleCursor(handle);
            layer.add(handle);
            wire.handles.push(handle);
          })(i);
        }
        notifyChange();
        layer.batchDraw();
        return;
      }
      if (bendIndex < 0 || bendIndex >= wire.bends.length) {
        return;
      }
      wire.bends[bendIndex].x = pos.x;
      wire.bends[bendIndex].y = pos.y;
      refreshWireGeometry(wire);
      if (wire.handles && wire.handles[bendIndex]) {
        wire.handles[bendIndex].position(wire.bends[bendIndex]);
      }
      layer.batchDraw();
    }

    /**
     * Ends the mid-handle gesture.
     */
    function onUp() {
      stage.off(".wireMidpoint");
      if (inserted) {
        showBendHandles(wire);
        notifyChange();
      }
      layer.batchDraw();
    }

    stage.on("mousemove.wireMidpoint touchmove.wireMidpoint", onMove);
    stage.on("mouseup.wireMidpoint touchend.wireMidpoint", onUp);
  }

  /**
   * Shows draggable bend + midpoint handles for the selected wire.
   * @param {object} wire - Wire record.
   */
  function showBendHandles(wire) {
    destroyBendHandles(wire);
    wire.handles = [];
    wire.midHandles = [];

    refreshMidpointHandles(wire);

    for (let i = 0; i < wire.bends.length; i += 1) {
      (function (bendIndex) {
        const bend = wire.bends[bendIndex];
        const handle = new Konva.Circle({
          x: bend.x,
          y: bend.y,
          radius: BEND_HANDLE_RADIUS,
          fill: "#ffffff",
          stroke: "#2563eb",
          strokeWidth: 2,
          hitStrokeWidth: BEND_HANDLE_HIT_STROKE,
          draggable: true,
          name: "bend-handle",
        });

        handle.on("mousedown touchstart", function (evt) {
          evt.cancelBubble = true;
        });

        handle.on("dragstart", function () {
          pushHistory();
          destroyMidHandles(wire);
          const stage = handle.getStage();
          if (stage) {
            stage.container().style.cursor = "crosshair";
          }
        });

        handle.on("dragmove", function () {
          wire.bends[bendIndex].x = handle.x();
          wire.bends[bendIndex].y = handle.y();
          refreshWireGeometry(wire);
          layer.batchDraw();
        });

        handle.on("dragend", function () {
          refreshMidpointHandles(wire);
          layer.batchDraw();
          notifyChange();
          const stage = handle.getStage();
          if (stage) {
            stage.container().style.cursor = "crosshair";
          }
        });

        handle.on("click tap", function (evt) {
          evt.cancelBubble = true;
          selectWire(wire, null);
        });

        handle.on("dblclick dbltap", function (evt) {
          evt.cancelBubble = true;
          removeBend(wire, bendIndex);
        });

        bindBendHandleCursor(handle);
        layer.add(handle);
        wire.handles.push(handle);
      })(i);
    }

    layer.batchDraw();
  }

  /**
   * Deselects the currently selected wire, if any.
   * @param {{ silent?: boolean }} [clearOpts] - Pass silent to skip selection listeners.
   */
  function clearWireSelection(clearOpts) {
    const silent = !!(clearOpts && clearOpts.silent);
    if (selectedWire) {
      applyWireStroke(selectedWire, false);
      destroyBendHandles(selectedWire);
      selectedWire = null;
      if (!silent) {
        notifySelectionChange(null, null);
      }
    }
  }

  /**
   * Selects a wire for editing bends or deletion.
   * @param {object} wire - Wire record from the manager.
   * @param {{ x: number; y: number }|null} [worldPos] - Optional menu anchor.
   */
  function selectWire(wire, worldPos) {
    clearWireSelection({ silent: true });
    selectedWire = wire;
    applyWireStroke(wire, true);
    wire.line.moveToTop();
    if (wire.understroke) {
      wire.understroke.moveToTop();
      wire.line.moveToTop();
    }
    showBendHandles(wire);
    notifySelectionChange(wire, worldPos || null);
    layer.batchDraw();
  }

  /**
   * Adds a bend point on a wire near the given stage position.
   * @param {object} wire - Wire record.
   * @param {number} x - Layer x of the new bend.
   * @param {number} y - Layer y of the new bend.
   */
  function addBend(wire, x, y) {
    pushHistory();
    const fromPos = getTerminalPosition(wire.from, layer);
    const toPos = getTerminalPosition(wire.to, layer);
    const segmentIndex = findClosestSegmentIndex(
      fromPos,
      wire.bends,
      toPos,
      { x: x, y: y }
    );
    wire.bends.splice(segmentIndex, 0, { x: x, y: y });
    refreshWireGeometry(wire);
    selectWire(wire, null);
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
      notifySelectionChange(wire, null);
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
      if (selectedWire === wire) {
        showBendHandles(wire);
      }
    }
    if (draftLine && pendingTerminal) {
      const pointer = layer.getRelativePointerPosition();
      if (pointer) {
        setDraftDrag(pendingTerminal, pointer);
      }
    }
    layer.batchDraw();
  }

  /**
   * Creates a wire between two terminals.
   * @param {{ node: Konva.Circle }} from - First terminal.
   * @param {{ node: Konva.Circle }} to - Second terminal.
   * @param {string} colorKey - Key in WIRE_COLORS.
   * @param {{ selectable?: boolean, bends?: Array<{x: number, y: number}>, recordHistory?: boolean }} [wireOpts] - Wire options.
   */
  function addWire(from, to, colorKey, wireOpts) {
    const options = wireOpts || {};
    const selectable = options.selectable !== false;
    const recordHistory = options.recordHistory !== false && !restoring;
    const bends = [];
    if (options.bends) {
      for (let i = 0; i < options.bends.length; i += 1) {
        bends.push({ x: options.bends[i].x, y: options.bends[i].y });
      }
    }

    if (recordHistory) {
      pushHistory();
    }

    const wire = {
      id: "wire-" + wires.length + "-" + Date.now(),
      from: from,
      to: to,
      colorKey: colorKey,
      bends: bends,
      handles: [],
      midHandles: [],
      selectable: selectable,
      line: null,
      understroke: null,
    };

    const points = buildPoints(wire);
    const understroke = new Konva.Line({
      points: points,
      stroke: WIRE_UNDERSTROKE_COLOR,
      strokeWidth: WIRE_STROKE_WIDTH + WIRE_UNDERSTROKE_PAD,
      lineCap: "round",
      lineJoin: "round",
      tension: WIRE_TENSION,
      listening: false,
      name: "wire-understroke",
    });
    const line = new Konva.Line({
      points: points,
      stroke: WIRE_COLORS[colorKey] || WIRE_COLORS.black,
      strokeWidth: WIRE_STROKE_WIDTH,
      lineCap: "round",
      lineJoin: "round",
      tension: WIRE_TENSION,
      hitStrokeWidth: 16,
      listening: true,
      name: "wire-line",
    });
    wire.understroke = understroke;
    wire.line = line;

    line.on("click tap", function (evt) {
      evt.cancelBubble = true;
      const pos = layer.getRelativePointerPosition();
      selectWire(wire, pos);
    });

    line.on("dblclick dbltap", function (evt) {
      evt.cancelBubble = true;
      const pos = layer.getRelativePointerPosition();
      if (!pos) {
        return;
      }
      addBend(wire, pos.x, pos.y);
    });

    layer.add(understroke);
    layer.add(line);
    // New wires stack above older ones (understroke immediately under stroke).
    understroke.moveToTop();
    line.moveToTop();

    wires.push(wire);
    notifyChange();
    layer.batchDraw();
    return wire;
  }

  /**
   * Connects two terminals when the pair is valid and new.
   * @param {object} from - First terminal.
   * @param {object} to - Second terminal.
   * @param {string} colorKey - Wire color key.
   */
  function connectTerminals(from, to, colorKey) {
    if (!from || !to) {
      return null;
    }
    if (terminalKey(from) === terminalKey(to)) {
      return null;
    }
    if (hasWireBetween(from, to)) {
      return null;
    }
    clearWireSelection();
    return addWire(from, to, colorKey, { selectable: true });
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
    destroyBendHandles(wire);
    if (wire.understroke) {
      wire.understroke.destroy();
    }
    wire.line.destroy();
    wires.splice(index, 1);
    if (selectedWire === wire) {
      selectedWire = null;
      notifySelectionChange(null, null);
    }
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
   * Changes the color of an existing wire.
   * @param {object} wire - Wire to recolor.
   * @param {string} colorKey - New color key.
   */
  function setWireColorKey(wire, colorKey) {
    if (!wire || wire.selectable === false) {
      return;
    }
    if (!WIRE_COLORS[colorKey] || wire.colorKey === colorKey) {
      return;
    }
    pushHistory();
    wire.colorKey = colorKey;
    applyWireStroke(wire, selectedWire === wire);
    notifyChange();
    if (selectedWire === wire) {
      notifySelectionChange(wire, null);
    }
    layer.batchDraw();
  }

  /**
   * Removes every wire without recording undo (used for mode rebuilds).
   */
  function clearWires() {
    clearPendingHighlight();
    clearWireSelection();
    clearDraft();
    while (wires.length > 0) {
      const wire = wires.pop();
      destroyBendHandles(wire);
      if (wire.understroke) {
        wire.understroke.destroy();
      }
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
   * Returns the pending terminal, if any.
   */
  function getPendingTerminal() {
    return pendingTerminal;
  }

  /**
   * Returns the currently selected wire, if any.
   */
  function getSelectedWire() {
    return selectedWire;
  }

  /**
   * Resolves a terminal near a stage pointer (magnetic snap, then intersection).
   * @param {Konva.Stage} stage - Active stage.
   * @param {object} [excludeTerminal] - Terminal to skip (e.g. drag source).
   */
  function terminalAtPointer(stage, excludeTerminal) {
    if (!stage) {
      return null;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return null;
    }

    const excludeKey = excludeTerminal ? terminalKey(excludeTerminal) : null;
    /**
     * @param {object} terminal - Candidate terminal.
     */
    function shouldExclude(terminal) {
      return !!(excludeKey && terminalKey(terminal) === excludeKey);
    }

    if (typeof listTerminals === "function" && typeof getView === "function") {
      const view = getView();
      const terminals = listTerminals() || [];
      const snapped = nearestTerminalInScreenRadius(
        pointer,
        terminals,
        function (terminal) {
          return getTerminalPosition(terminal);
        },
        view,
        TERMINAL_SNAP_SCREEN_RADIUS,
        shouldExclude
      );
      if (snapped) {
        return snapped;
      }
    }

    if (typeof findTerminalFromNode !== "function") {
      return null;
    }
    const shape = stage.getIntersection(pointer);
    if (!shape) {
      return null;
    }
    const hit = findTerminalFromNode(shape);
    if (hit && shouldExclude(hit)) {
      return null;
    }
    return hit;
  }

  /**
   * Handles a terminal click for wire drawing in Lab mode (pending / complete).
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

    connectTerminals(pendingTerminal, terminal, colorKey);
    clearPendingHighlight();
    layer.batchDraw();
  }

  /**
   * Completes a drag-connect if the pointer is near another terminal.
   * @param {object} fromTerminal - Start terminal.
   * @param {Konva.Stage} stage - Active stage.
   * @param {string} colorKey - Active wire color key.
   */
  function completeDragConnect(fromTerminal, stage, colorKey) {
    clearDraft();
    const target = terminalAtPointer(stage, fromTerminal);
    clearSnapHighlight();
    if (target && terminalKey(target) !== terminalKey(fromTerminal)) {
      connectTerminals(fromTerminal, target, colorKey);
    }
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
    connectTerminals: connectTerminals,
    removeWire: removeWire,
    removeSelectedWire: removeSelectedWire,
    setWireColorKey: setWireColorKey,
    clearWires: clearWires,
    clearPendingHighlight: clearPendingHighlight,
    clearSnapHighlight: clearSnapHighlight,
    clearPressHighlight: clearPressHighlight,
    clearWireSelection: clearWireSelection,
    clearDraft: clearDraft,
    setDraftDrag: setDraftDrag,
    setPendingTerminal: setPendingTerminal,
    setPressHighlight: setPressHighlight,
    setSnapHighlight: setSnapHighlight,
    updateWirePositions: updateWirePositions,
    handleTerminalClick: handleTerminalClick,
    completeDragConnect: completeDragConnect,
    terminalAtPointer: terminalAtPointer,
    getWires: getWires,
    getSelectedWire: getSelectedWire,
    getPendingTerminal: getPendingTerminal,
    terminalKey: terminalKey,
    hasPendingTerminal: hasPendingTerminal,
    hasWireBetween: hasWireBetween,
    selectWire: selectWire,
    undo: undo,
    canUndo: canUndo,
    clearHistory: clearHistory,
    exportHistory: exportHistory,
    importHistory: importHistory,
    exportSnapshot: exportSnapshot,
    importSnapshot: importSnapshot,
  };
}
