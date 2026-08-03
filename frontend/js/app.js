import Konva from "konva";
import { applyDoorbellButtonVisual } from "./components/button.js";
import { COMPONENT_TYPES } from "./components/constants.js";
import { applyLampVisual } from "./components/lamp.js";
import { createLayoutFromConfig } from "./components/registry.js";
import { findTerminal } from "./components/shared.js";
import { applySwitchVisual } from "./components/switch-shared.js";
import { createWireManager, wireDragThresholdForEvent } from "./wires.js";
import { createWireMenu } from "./wire-menu.js";
import { createCircuitSimulator } from "./circuit.js";
import { createSoundPlayer } from "./sounds.js";
import { createGrader } from "./grade.js";
import { resolveCoord } from "./lab-config.js";
import {
  BUTTON_SCALE_BY,
  INITIAL_VIEW,
  PAN_DRAG_THRESHOLD,
  PINCH_ZOOM_INTENSITY,
  STAGE_DEFAULT_CURSOR,
  applyViewToStage,
  boundsFromClientRect,
  centerBetween,
  clampView,
  distanceBetween,
  normalizeWheelDeltas,
  pinchZoomView,
  pointerToWorld,
  stagePointsFromTouches,
  worldToPointer,
  zoomAt,
} from "./canvas-nav.js";

// Keep receiving touchmove while a component is dragging so pinch can take over.
Konva.hitOnDragEnabled = true;

/**
 * Boots the doorbell circuit lab inside a host element using a YAML-derived config.
 * @param {HTMLElement} host - circuit-lab host (toolbar/stage live in host.shadowRoot when present).
 * @param {object} config - Normalized lab config from loadLabConfigFromPre.
 */
export function bootCircuitLab(host, config) {
  let mode = "demo";
  let wireColor = config.defaultWireColor;
  const availableWireColors = config.wireColors || [];
  let components = null;
  let testingSequence = false;
  /** @type {Array<object>|null} */
  let savedLabWires = null;
  /** @type {Array<object>|null} */
  let savedLabHistory = null;

  const uiRoot = host.shadowRoot || host;
  const toolbar = uiRoot.querySelector("[data-lab-toolbar]");
  const hintEl = uiRoot.querySelector("[data-lab-hint]");
  const modeDemoBtn = uiRoot.querySelector("[data-lab-mode=\"demo\"]");
  const modeLabBtn = uiRoot.querySelector("[data-lab-mode=\"lab\"]");
  const btnTest = uiRoot.querySelector("[data-lab-action=\"test\"]");
  const btnCheck = uiRoot.querySelector("[data-lab-action=\"check\"]");
  const btnUndo = uiRoot.querySelector("[data-lab-action=\"undo\"]");
  const stageWrap = uiRoot.querySelector("[data-lab-stage-wrap]");
  const stageContainer = uiRoot.querySelector("[data-lab-stage]");
  const titleEl = uiRoot.querySelector("[data-lab-title]");
  const zoomOutBtn = uiRoot.querySelector("[data-lab-zoom=\"out\"]");
  const zoomInBtn = uiRoot.querySelector("[data-lab-zoom=\"in\"]");
  const zoomResetBtn = uiRoot.querySelector("[data-lab-zoom=\"reset\"]");
  const zoomLabel = uiRoot.querySelector("[data-lab-zoom-label]");

  if (titleEl) {
    titleEl.textContent = config.title;
  }

  /**
   * Syncs CSS variable for stage height under the toolbar.
   */
  function syncToolbarHeight() {
    const height = toolbar ? toolbar.offsetHeight : 52;
    host.style.setProperty("--toolbar-height", height + "px");
  }

  /**
   * Sets the hint text and optional pass/fail styling.
   * @param {string} text - Message to show.
   * @param {"pass" | "fail" | ""} [status] - Optional status class.
   */
  function setHint(text, status) {
    hintEl.textContent = text;
    hintEl.classList.remove("pass", "fail");
    if (status) {
      hintEl.classList.add(status);
    }
  }

  syncToolbarHeight();

  const stage = new Konva.Stage({
    container: stageContainer,
    width: host.clientWidth || window.innerWidth,
    height: Math.max(
      200,
      (host.clientHeight || window.innerHeight) - (toolbar ? toolbar.offsetHeight : 52)
    ),
  });

  const wireLayer = new Konva.Layer();
  const componentLayer = new Konva.Layer();
  stage.add(wireLayer);
  stage.add(componentLayer);

  /** @type {{ scale: number; x: number; y: number }} */
  let view = { scale: INITIAL_VIEW.scale, x: INITIAL_VIEW.x, y: INITIAL_VIEW.y };
  /** @type {{ minX: number; minY: number; maxX: number; maxY: number }} */
  let contentBounds = {
    minX: 0,
    minY: 0,
    maxX: stage.width(),
    maxY: stage.height(),
  };
  let suppressStageClick = false;
  /** @type {{ x: number; y: number }|null} */
  let pinchLastCenter = null;
  let pinchLastDist = 0;

  stage.container().style.cursor = STAGE_DEFAULT_CURSOR;

  /**
   * Stops any in-progress empty-canvas pan listeners and UI.
   */
  function endStagePan() {
    stage.off(".stagePan");
    if (stageWrap) {
      stageWrap.classList.remove("lab-stage-wrap--panning");
    }
    stage.container().style.cursor = STAGE_DEFAULT_CURSOR;
  }

  /**
   * Returns the current stage pixel size.
   */
  function viewportSize() {
    return { width: stage.width(), height: stage.height() };
  }

  /**
   * Updates the zoom percent label in the toolbar.
   */
  function syncZoomLabel() {
    if (zoomLabel) {
      zoomLabel.textContent = Math.round(view.scale * 100) + "%";
    }
  }

  /**
   * Applies a camera view to the stage and refreshes the zoom label.
   * @param {{ scale: number; x: number; y: number }} next - Camera to apply.
   */
  function setView(next) {
    view = clampView(next, viewportSize(), contentBounds);
    applyViewToStage(stage, view);
    syncZoomLabel();
    syncWireMenuPosition();
    stage.batchDraw();
  }

  /**
   * Reads live component positions and updates pan limits.
   */
  function syncContentBounds() {
    const rect = componentLayer.getClientRect({
      relativeTo: stage,
      skipShadow: true,
    });
    if (rect.width <= 0 || rect.height <= 0) {
      contentBounds = {
        minX: 0,
        minY: 0,
        maxX: stage.width(),
        maxY: stage.height(),
      };
      return;
    }
    contentBounds = boundsFromClientRect(rect);
  }

  /**
   * Zooms toward the stage center by a fixed step.
   * @param {number} factor - Multiplier applied to the current scale.
   */
  function zoomBy(factor) {
    const size = viewportSize();
    setView(
      zoomAt(
        view,
        { x: size.width / 2, y: size.height / 2 },
        view.scale * factor,
        size,
        contentBounds
      )
    );
  }

  /**
   * Resets stage scale and pan to the default view.
   */
  function resetView() {
    setView(INITIAL_VIEW);
  }

  const sounds = createSoundPlayer();

  /**
   * Returns every component currently on the stage.
   */
  function componentList() {
    if (!components) {
      return [];
    }
    return Object.keys(components).map(function (key) {
      return components[key];
    });
  }

  /**
   * Returns switch/button components in document/config order for the test sequence.
   */
  function switchList() {
    return componentList().filter(function (component) {
      return component && component.isSwitch;
    });
  }

  /**
   * Returns config ids of toggle switches that are currently closed.
   */
  function closedToggleIds() {
    const ids = [];
    const list = componentList();
    for (let i = 0; i < list.length; i += 1) {
      const component = list[i];
      if (component && component.isToggle && component.isClosed && component.configId) {
        ids.push(component.configId);
      }
    }
    return ids;
  }

  /**
   * Finds the lamp component for a simulation load (by load id or requireHot component).
   * @param {object} load - Normalized simulation load entry.
   */
  function lampForLoad(load) {
    if (!components || !load) {
      return null;
    }
    const byId = components[load.id];
    if (byId && byId.componentType === COMPONENT_TYPES.LAMP) {
      return byId;
    }
    const hotComp = load.requireHot && load.requireHot.component;
    if (hotComp) {
      const byHot = components[hotComp];
      if (byHot && byHot.componentType === COMPONENT_TYPES.LAMP) {
        return byHot;
      }
    }
    return null;
  }

  /**
   * Applies config-driven load feedback: sound profiles and/or lamp glow.
   * @param {{ [loadId: string]: boolean }} energized - Energized map from simulate().
   * @param {{ playSounds?: boolean }} [options] - Whether to play sound profiles.
   */
  function applyLoadFeedback(energized, options) {
    const playSounds = !options || options.playSounds !== false;
    const loads =
      config.simulation && Array.isArray(config.simulation.loads)
        ? config.simulation.loads
        : [];

    for (let i = 0; i < loads.length; i += 1) {
      const load = loads[i];
      const isLive = !!(energized && energized[load.id]);
      const feedback = load.feedback;
      if (!feedback) {
        continue;
      }

      if (feedback.type === "sound") {
        if (playSounds && isLive && feedback.profile) {
          sounds.playProfile(feedback.profile);
        }
        continue;
      }

      if (feedback.type === "light") {
        const lamp = lampForLoad(load);
        if (lamp) {
          applyLampVisual(lamp, { lit: isLive });
        }
      }
    }
  }

  /**
   * Returns every terminal currently on the stage.
   */
  function listTerminals() {
    const result = [];
    const list = componentList();
    for (let i = 0; i < list.length; i += 1) {
      const group = list[i];
      if (!group || !group.terminals) {
        continue;
      }
      for (let t = 0; t < group.terminals.length; t += 1) {
        result.push(group.terminals[t]);
      }
    }
    return result;
  }

  /**
   * Resolves a terminal key (componentId:terminalId) to a terminal object.
   * @param {string} key - Terminal key from the wire manager.
   */
  function resolveTerminal(key) {
    if (!components || !key) {
      return null;
    }
    const sep = key.lastIndexOf(":");
    if (sep <= 0) {
      return null;
    }
    const componentId = key.slice(0, sep);
    const terminalId = key.slice(sep + 1);
    const list = componentList();
    for (let i = 0; i < list.length; i += 1) {
      const component = list[i];
      if (component && component.componentId === componentId) {
        return findTerminal(component, terminalId);
      }
    }
    return null;
  }

  /**
   * Enables or disables the Undo button from wire history state.
   * @param {boolean} canUndo - Whether undo is available.
   */
  function syncUndoButton(canUndo) {
    btnUndo.disabled = !canUndo;
  }

  /**
   * Walks up from a Konva node to find its terminal metadata.
   * @param {Konva.Node|null} node - Hit node from the stage.
   */
  function findTerminalFromNode(node) {
    let current = node;
    while (current) {
      const list = componentList();
      for (let i = 0; i < list.length; i += 1) {
        const group = list[i];
        if (!group || !group.terminals) {
          continue;
        }
        for (let t = 0; t < group.terminals.length; t += 1) {
          const terminal = group.terminals[t];
          if (terminal.node === current || terminal.handle === current) {
            return terminal;
          }
        }
      }
      current = typeof current.getParent === "function" ? current.getParent() : null;
    }
    return null;
  }

  /**
   * Repositions the floating wire menu after pan/zoom.
   */
  function syncWireMenuPosition() {
    if (!wireMenu || !stageWrap) {
      return;
    }
    wireMenu.syncPosition(
      function (world) {
        return worldToPointer(world, view);
      },
      { width: stageWrap.clientWidth, height: stageWrap.clientHeight }
    );
  }

  /**
   * Opens or closes the floating wire menu from a selection change.
   * Demo reference wires stay bendable but skip the actions menu.
   * @param {object|null} wire - Selected wire, or null.
   * @param {{ x: number; y: number }|null} worldPos - Menu anchor in layer space.
   */
  function handleWireSelectionChange(wire, worldPos) {
    if (!wireMenu || !stageWrap) {
      return;
    }
    if (!wire) {
      wireMenu.close();
      return;
    }
    if (wire.selectable === false) {
      wireMenu.close();
      return;
    }
    // Bend-handle reselects without a click point — keep menu closed / update color only.
    if (!worldPos) {
      if (wireMenu.isOpen()) {
        wireMenu.setColor(
          wire.colorKey,
          function (world) {
            return worldToPointer(world, view);
          },
          { width: stageWrap.clientWidth, height: stageWrap.clientHeight }
        );
      }
      return;
    }
    // Click-away / toggle: if menu is open (or just dismissed), close instead of reopen.
    if (wireMenu.shouldSuppressOpen()) {
      wireMenu.close();
      return;
    }
    wireMenu.open({
      colorKey: wire.colorKey,
      canDelete: true,
      world: worldPos,
      screen: worldToPointer(worldPos, view),
      viewport: {
        width: stageWrap.clientWidth,
        height: stageWrap.clientHeight,
      },
    });
  }

  const wireMenu = stageWrap
    ? createWireMenu(stageWrap, {
        colorOptions: config.wireColorOptions,
        onDelete: function () {
          wireManager.removeSelectedWire();
          wireMenu.close();
        },
        onPickColor: function (colorKey) {
          const selected = wireManager.getSelectedWire();
          if (selected) {
            wireManager.setWireColorKey(selected, colorKey);
          }
          setWireColor(colorKey);
          syncWireMenuPosition();
        },
        onDismiss: function () {
          wireMenu.close();
        },
      })
    : null;

  const wireManager = createWireManager(wireLayer, {
    resolveTerminal: resolveTerminal,
    findTerminalFromNode: findTerminalFromNode,
    listTerminals: listTerminals,
    getView: function () {
      return view;
    },
    onHistoryChange: syncUndoButton,
    onChange: handleWiresChanged,
    onSelectionChange: handleWireSelectionChange,
  });

  /**
   * Returns the live component map for simulators.
   */
  function getComponents() {
    return components || {};
  }

  /**
   * Returns the current wire list for simulators.
   */
  function getWires() {
    return wireManager.getWires();
  }

  const simulator = createCircuitSimulator(getWires, getComponents, config.simulation);
  const grader = createGrader(simulator, getComponents, config.grading);

  /**
   * Re-simulates after wire add/remove/undo (topology changed).
   */
  function handleWiresChanged() {
    if (!components) {
      return;
    }
    simulator.highlightPath({}, false);
    refreshSimulation({ playSounds: false });
    componentLayer.batchDraw();
  }

  /**
   * Looks up a terminal by component key and terminal id.
   * @param {string} componentKey - Key in the components map.
   * @param {string} terminalId - Local terminal id.
   */
  function term(componentKey, terminalId) {
    return findTerminal(components[componentKey], terminalId);
  }

  /**
   * Adds a non-selectable reference wire (Demo mode).
   * @param {{ component: string, terminal: string }} from - Source endpoint.
   * @param {{ component: string, terminal: string }} to - Target endpoint.
   * @param {string} colorKey - Wire color key.
   */
  function refWire(from, to, colorKey) {
    wireManager.addWire(
      term(from.component, from.terminal),
      term(to.component, to.terminal),
      colorKey,
      { selectable: false, recordHistory: false }
    );
  }

  /**
   * Wires the Demo circuit from the YAML demo.wires list.
   */
  function loadReferenceWires() {
    for (let i = 0; i < config.demoWires.length; i += 1) {
      const wire = config.demoWires[i];
      refWire(wire.from, wire.to, wire.color);
    }
  }

  /**
   * Creates components once and keeps them across Demo/Lab switches.
   */
  function ensureComponents() {
    if (components) {
      return;
    }

    components = createLayoutFromConfig(
      config,
      stage.width(),
      stage.height(),
      resolveCoord
    );

    const list = componentList();
    for (let i = 0; i < list.length; i += 1) {
      const group = list[i];
      componentLayer.add(group);
      bindComponent(group);
    }
    syncContentBounds();
    setView(view);
  }

  /**
   * Re-runs continuity with currently closed toggles and applies load visuals.
   * @param {{ playSounds?: boolean }} [options] - Whether to play sound profiles.
   */
  function refreshSimulation(options) {
    const result = simulator.simulate(closedToggleIds());
    applyLoadFeedback(result.energized, {
      playSounds: !!(options && options.playSounds),
    });
    return result;
  }

  /**
   * Opens all toggle switches and refreshes load feedback from a fresh simulation.
   */
  function resetSwitchAndLoadFeedback() {
    const list = componentList();
    for (let i = 0; i < list.length; i += 1) {
      const component = list[i];
      if (component && component.isToggle && component.isClosed) {
        applySwitchVisual(component, { closed: false });
      }
    }
    refreshSimulation({ playSounds: false });
  }

  /**
   * Loads Demo reference wiring (does not touch saved Lab state).
   */
  function showDemoCircuit() {
    wireManager.clearPendingHighlight();
    wireManager.clearWireSelection();
    simulator.highlightPath({}, false);
    wireManager.clearWires();
    wireManager.clearHistory();
    loadReferenceWires();
    resetSwitchAndLoadFeedback();
    btnCheck.disabled = true;
    setHint(config.hints.demo);
    componentLayer.draw();
    wireLayer.draw();
  }

  /**
   * Loads Lab wiring from the saved snapshot (or empty on first visit).
   */
  function showLabCircuit() {
    wireManager.clearPendingHighlight();
    wireManager.clearWireSelection();
    simulator.highlightPath({}, false);
    wireManager.clearWires();
    wireManager.clearHistory();
    if (savedLabWires) {
      wireManager.importSnapshot(savedLabWires);
    }
    if (savedLabHistory) {
      wireManager.importHistory(savedLabHistory);
    }
    resetSwitchAndLoadFeedback();
    btnCheck.disabled = false;
    setHint(config.hints.lab);
    wireManager.updateWirePositions();
    componentLayer.draw();
    wireLayer.draw();
  }

  /**
   * Saves the current Lab wires and undo stack before leaving Lab mode.
   */
  function persistLabState() {
    savedLabWires = wireManager.exportSnapshot();
    savedLabHistory = wireManager.exportHistory();
  }

  /**
   * Switches between Demo and Lab modes without wiping Lab progress.
   * @param {"demo" | "lab"} nextMode - Mode to activate.
   */
  function setMode(nextMode) {
    if (mode === nextMode) {
      return;
    }
    testingSequence = false;
    runTestSequence.activeId = null;
    btnTest.disabled = false;

    if (mode === "lab") {
      persistLabState();
    }

    mode = nextMode;
    syncModeButtons();
    ensureComponents();

    if (mode === "demo") {
      showDemoCircuit();
    } else {
      showLabCircuit();
    }
    if (wireMenu) {
      wireMenu.close();
    }
  }

  /**
   * Binds drag, terminal click, and button press handlers on a component.
   * @param {Konva.Group} group - Component group.
   */
  function bindComponent(group) {
    group.on("dragmove", function () {
      wireManager.updateWirePositions();
    });

    group.on("mouseenter", function (evt) {
      if (isTerminalTarget(evt.target)) {
        return;
      }
      if (group.isSwitch && (isButtonPadTarget(evt.target) || isSwitchHitTarget(evt.target))) {
        return;
      }
      stage.container().style.cursor = "grab";
    });
    group.on("mouseleave", function () {
      stage.container().style.cursor = STAGE_DEFAULT_CURSOR;
    });
    group.on("dragstart", function () {
      stage.container().style.cursor = "grabbing";
    });
    group.on("dragend", function () {
      stage.container().style.cursor = "grab";
      syncContentBounds();
      setView(view);
    });

    if (group.terminals) {
      for (let i = 0; i < group.terminals.length; i += 1) {
        bindTerminal(group.terminals[i]);
      }
    }

    if (group.isSwitch) {
      if (group.isToggle) {
        bindToggleSwitch(group);
      } else {
        bindButton(group);
      }
    }
  }

  /**
   * Returns whether a Konva event target is a terminal (or its handle).
   * @param {Konva.Node} target - Event target node.
   */
  function isTerminalTarget(target) {
    if (!target || !target.name) {
      return false;
    }
    const name = target.name();
    return name === "terminal" || name === "terminal-handle";
  }

  /**
   * Lab click-or-drag wire gesture: tap to pending/connect, drag for rubber-band.
   * @param {object} terminal - Terminal metadata.
   * @param {Konva.KonvaEventObject} evt - Pointer down event.
   */
  function handleTerminalPointerDown(terminal, evt) {
    evt.cancelBubble = true;
    if (evt.evt && evt.evt.preventDefault) {
      evt.evt.preventDefault();
    }

    // Show a large halo immediately so a finger does not fully hide the node.
    wireManager.setPressHighlight(terminal, evt);

    if (mode !== "lab") {
      /**
       * Clears the demo/read-only press halo on release.
       */
      function onDemoUp() {
        stage.off(".terminalPress");
        wireManager.clearPressHighlight();
      }
      stage.on("mouseup.terminalPress touchend.terminalPress", onDemoUp);
      return;
    }

    const group = terminal.componentGroup;
    const startPointer = stage.getPointerPosition();
    if (!startPointer) {
      wireManager.clearPressHighlight();
      return;
    }

    let dragging = false;
    const dragThreshold = wireDragThresholdForEvent(evt);
    group.draggable(false);
    if (typeof group.stopDrag === "function") {
      group.stopDrag();
    }

    /**
     * Starts a rubber-band once the pointer moves past the drag threshold.
     * @param {Konva.KonvaEventObject} moveEvt - Move event.
     */
    function onMove(moveEvt) {
      moveEvt.evt.preventDefault();
      const pos = stage.getPointerPosition();
      if (!pos) {
        return;
      }
      const dx = pos.x - startPointer.x;
      const dy = pos.y - startPointer.y;

      if (!dragging) {
        if (dx * dx + dy * dy < dragThreshold * dragThreshold) {
          return;
        }
        dragging = true;
        if (wireMenu) {
          wireMenu.close();
        }
        wireManager.clearWireSelection();
        wireManager.clearPendingHighlight();
        stage.container().style.cursor = "crosshair";
      }

      const world = pointerToWorld(pos, view);
      wireManager.setDraftDrag(terminal, world);
      wireManager.setSnapHighlight(wireManager.terminalAtPointer(stage, terminal));
    }

    /**
     * Completes drag-connect or tap pending/connect.
     */
    function onUp() {
      stage.off(".terminalWire");
      group.draggable(true);
      stage.container().style.cursor = STAGE_DEFAULT_CURSOR;

      if (dragging) {
        wireManager.completeDragConnect(terminal, stage, wireColor);
        return;
      }

      wireManager.clearSnapHighlight();
      // Tap: pending / complete two-click connect.
      if (wireMenu) {
        wireMenu.close();
      }
      wireManager.clearWireSelection();
      wireManager.handleTerminalClick(terminal, wireColor, true);
      // Drop press tracking; pending stays highlighted via sticky check.
      wireManager.clearPressHighlight();
    }

    stage.on("mousemove.terminalWire touchmove.terminalWire", onMove);
    stage.on("mouseup.terminalWire touchend.terminalWire", onUp);
  }

  /**
   * Binds wire gesture handling on a terminal.
   * @param {object} terminal - Terminal metadata.
   */
  function bindTerminal(terminal) {
    const handle = terminal.handle || terminal.node;

    terminal.onPointerDown = function (evt) {
      handleTerminalPointerDown(terminal, evt);
    };

    handle.on("mouseenter", function () {
      stage.container().style.cursor = mode === "lab" ? "crosshair" : STAGE_DEFAULT_CURSOR;
    });
    handle.on("mouseleave", function () {
      stage.container().style.cursor = STAGE_DEFAULT_CURSOR;
    });
  }

  /**
   * Visually marks a button as pressed or released.
   * @param {Konva.Group} button - Button component.
   * @param {boolean} pressed - Whether the button is down.
   */
  function setButtonPressedVisual(button, pressed) {
    button.isPressed = pressed;
    applyDoorbellButtonVisual(button, { pressed: pressed });
    componentLayer.batchDraw();
  }

  /**
   * Runs simulation for a pressed button and applies config-driven load feedback.
   * @param {Konva.Group} button - Pressed button component.
   */
  function handleButtonPress(button) {
    const closedIds = closedToggleIds();
    if (button.configId) {
      closedIds.push(button.configId);
    }
    const result = simulator.simulate(closedIds);
    simulator.highlightPath(result.pathKeys, true);
    applyLoadFeedback(result.energized, { playSounds: true });
    componentLayer.batchDraw();
  }

  /**
   * Clears path highlight when a button is released; keeps toggle-driven lamp state.
   */
  function handleButtonRelease() {
    simulator.highlightPath({}, false);
    refreshSimulation({ playSounds: false });
    componentLayer.batchDraw();
  }

  /**
   * Toggles an SPST switch, re-simulates, and applies load feedback.
   * @param {Konva.Group} sw - Toggle switch component.
   */
  function handleToggleSwitch(sw) {
    applySwitchVisual(sw, { closed: !sw.isClosed });
    const result = simulator.simulate(closedToggleIds());
    const anyLive = Object.keys(result.energized || {}).some(function (id) {
      return result.energized[id];
    });
    simulator.highlightPath(result.pathKeys, anyLive);
    applyLoadFeedback(result.energized, { playSounds: true });
    componentLayer.batchDraw();
  }

  /**
   * Returns whether a Konva event target is the doorbell press pad.
   * @param {Konva.Node} target - Event target node.
   */
  function isButtonPadTarget(target) {
    if (!target || !target.name) {
      return false;
    }
    return target.name() === "button-pad";
  }

  /**
   * Returns whether a Konva event target is the SPST switch hit area.
   * @param {Konva.Node} target - Event target node.
   */
  function isSwitchHitTarget(target) {
    if (!target || !target.name) {
      return false;
    }
    return target.name() === "switch-hit";
  }

  /**
   * Binds press/release interaction on a doorbell button.
   * @param {Konva.Group} button - Button component.
   */
  function bindButton(button) {
    const pad = button.buttonPad;
    if (!pad) {
      return;
    }

    pad.on("mousedown touchstart", function (evt) {
      evt.cancelBubble = true;
      setButtonPressedVisual(button, true);
      handleButtonPress(button);
    });

    pad.on("mouseenter", function () {
      stage.container().style.cursor = "pointer";
      if (!button.isPressed) {
        applyDoorbellButtonVisual(button, { hovered: true });
        componentLayer.batchDraw();
      }
    });

    pad.on("mouseleave", function () {
      stage.container().style.cursor = "default";
      applyDoorbellButtonVisual(button, { hovered: false });
      componentLayer.batchDraw();
      if (!button.isPressed) {
        return;
      }
      setButtonPressedVisual(button, false);
      handleButtonRelease();
    });

    button.on("dragstart", function () {
      if (!button.isPressed) {
        return;
      }
      setButtonPressedVisual(button, false);
      handleButtonRelease();
    });

    button.on("mouseup touchend", function () {
      if (!button.isPressed) {
        return;
      }
      setButtonPressedVisual(button, false);
      handleButtonRelease();
    });
  }

  /**
   * Binds click-to-toggle interaction on an SPST switch.
   * @param {Konva.Group} sw - Toggle switch component.
   */
  function bindToggleSwitch(sw) {
    const hit = sw.switchHit;
    if (!hit) {
      return;
    }

    hit.on("click tap", function (evt) {
      evt.cancelBubble = true;
      handleToggleSwitch(sw);
    });

    hit.on("mouseenter", function () {
      stage.container().style.cursor = "pointer";
    });

    hit.on("mouseleave", function () {
      stage.container().style.cursor = "default";
    });
  }

  /**
   * Updates mode toggle button active states.
   */
  function syncModeButtons() {
    const isDemo = mode === "demo";
    modeDemoBtn.classList.toggle("active", isDemo);
    modeLabBtn.classList.toggle("active", !isDemo);
    modeDemoBtn.setAttribute("aria-pressed", isDemo ? "true" : "false");
    modeLabBtn.setAttribute("aria-pressed", isDemo ? "false" : "true");
  }

  /**
   * Remembers the active wire color for new wires.
   * @param {string} colorKey - Color key from the lab palette.
   */
  function setWireColor(colorKey) {
    if (availableWireColors.indexOf(colorKey) === -1) {
      return;
    }
    wireColor = colorKey;
  }

  /**
   * Runs an automated press/toggle of each switch in sequence.
   */
  function runTestSequence() {
    if (testingSequence || !components) {
      return;
    }

    const sequence = switchList();
    if (sequence.length === 0) {
      return;
    }

    testingSequence = true;
    const sequenceId = Date.now();
    runTestSequence.activeId = sequenceId;
    btnTest.disabled = true;
    setHint("Testing: operating switches in sequence…");

    let index = 0;

    /**
     * Returns whether this test run is still the active one.
     */
    function isActive() {
      return testingSequence && runTestSequence.activeId === sequenceId && components;
    }

    /**
     * Advances to the next switch/button in the test sequence.
     */
    function step() {
      if (!isActive()) {
        testingSequence = false;
        btnTest.disabled = false;
        return;
      }

      if (index >= sequence.length) {
        testingSequence = false;
        btnTest.disabled = false;
        setHint(mode === "demo" ? config.hints.demo : config.hints.lab);
        handleButtonRelease();
        return;
      }

      const sw = sequence[index];
      index += 1;

      if (sw.isToggle) {
        const wasClosed = !!sw.isClosed;
        handleToggleSwitch(sw);
        window.setTimeout(function () {
          if (!isActive()) {
            testingSequence = false;
            btnTest.disabled = false;
            return;
          }
          if (sw.isClosed !== wasClosed) {
            handleToggleSwitch(sw);
          }
          window.setTimeout(step, 280);
        }, 550);
        return;
      }

      setButtonPressedVisual(sw, true);
      handleButtonPress(sw);

      window.setTimeout(function () {
        if (!isActive()) {
          testingSequence = false;
          btnTest.disabled = false;
          return;
        }
        setButtonPressedVisual(sw, false);
        handleButtonRelease();
        window.setTimeout(step, 280);
      }, 550);
    }

    step();
  }

  /**
   * Grades the lab circuit and shows pass/fail feedback.
   */
  function runCheck() {
    if (mode !== "lab") {
      return;
    }
    const result = grader.grade();
    if (result.pass) {
      setHint(config.passMessage, "pass");
    } else {
      setHint("Fail — " + result.failures.join(" "), "fail");
    }
  }

  /**
   * Undoes the last wire edit if possible.
   */
  function runUndo() {
    if (!wireManager.canUndo()) {
      return;
    }
    wireManager.undo();
  }

  modeDemoBtn.addEventListener("click", function () {
    setMode("demo");
  });
  modeLabBtn.addEventListener("click", function () {
    setMode("lab");
  });
  btnTest.addEventListener("click", runTestSequence);
  btnCheck.addEventListener("click", runCheck);
  btnUndo.addEventListener("click", runUndo);

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", function () {
      zoomBy(1 / BUTTON_SCALE_BY);
    });
  }
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", function () {
      zoomBy(BUTTON_SCALE_BY);
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", resetView);
  }

  /**
   * Maps-style navigation: scroll pans; trackpad pinch (ctrl/meta+wheel) zooms.
   * @param {Konva.KonvaEventObject} e - Wheel event.
   */
  function handleWheel(e) {
    e.evt.preventDefault();
    const size = viewportSize();
    const deltas = normalizeWheelDeltas(e.evt, size);

    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      setView(
        zoomAt(
          view,
          pointer,
          view.scale * Math.exp(-deltas.deltaY * PINCH_ZOOM_INTENSITY),
          size,
          contentBounds
        )
      );
      return;
    }

    setView({
      scale: view.scale,
      x: view.x - deltas.deltaX,
      y: view.y - deltas.deltaY,
    });
  }

  /**
   * Starts click-drag panning when the pointer goes down on empty canvas.
   * @param {Konva.KonvaEventObject} e - Pointer down event.
   */
  function handleStagePointerDown(e) {
    if (e.target !== stage) {
      return;
    }
    // Stop mobile browsers from scrolling the page while we pan the lab.
    e.evt.preventDefault();
    const startPointer = stage.getPointerPosition();
    if (!startPointer) {
      return;
    }
    const origin = { x: startPointer.x, y: startPointer.y };
    const startView = { scale: view.scale, x: view.x, y: view.y };
    let panning = false;

    /**
     * Pans the view by the pointer delta (content follows the drag).
     * @param {Konva.KonvaEventObject} evt - Move event.
     */
    function onMove(evt) {
      // Two-finger pinch owns the gesture; leave one-finger pan alone.
      if (evt.evt.touches && evt.evt.touches.length >= 2) {
        endStagePan();
        return;
      }
      evt.evt.preventDefault();
      const pos = stage.getPointerPosition();
      if (!pos) {
        return;
      }
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      if (!panning) {
        if (dx * dx + dy * dy < PAN_DRAG_THRESHOLD * PAN_DRAG_THRESHOLD) {
          return;
        }
        panning = true;
        suppressStageClick = true;
        if (stageWrap) {
          stageWrap.classList.add("lab-stage-wrap--panning");
        }
        stage.container().style.cursor = "grabbing";
      }

      setView({
        scale: startView.scale,
        x: startView.x + dx,
        y: startView.y + dy,
      });
    }

    /**
     * Ends the pan gesture.
     */
    function onUp() {
      endStagePan();
    }

    stage.on("mousemove.stagePan touchmove.stagePan", onMove);
    stage.on("mouseup.stagePan touchend.stagePan", onUp);
  }

  /**
   * Two-finger pinch zoom (and pan with the midpoint) anywhere on the stage.
   * @param {Konva.KonvaEventObject} e - Touch move event.
   */
  function handlePinchMove(e) {
    const touches = e.evt.touches;
    if (!touches || touches.length < 2) {
      return;
    }
    e.evt.preventDefault();
    endStagePan();
    suppressStageClick = true;

    const points = stagePointsFromTouches(
      touches,
      stage.container().getBoundingClientRect()
    );
    const newCenter = centerBetween(points[0], points[1]);
    const dist = distanceBetween(points[0], points[1]);

    if (!pinchLastCenter || !(pinchLastDist > 0)) {
      // First pinch frame: stop any one-finger component drag fighting the gesture.
      let node = e.target;
      while (node && node !== stage) {
        if (node.isDragging && node.isDragging()) {
          node.stopDrag();
        }
        node = node.getParent();
      }
      pinchLastCenter = newCenter;
      pinchLastDist = dist;
      return;
    }

    setView(
      pinchZoomView(
        view,
        pinchLastCenter,
        pinchLastDist,
        newCenter,
        dist,
        viewportSize(),
        contentBounds
      )
    );
    pinchLastCenter = newCenter;
    pinchLastDist = dist;
  }

  /**
   * Clears pinch state once fewer than two fingers remain.
   * @param {Konva.KonvaEventObject} e - Touch end/cancel event.
   */
  function handlePinchEnd(e) {
    const touches = e.evt.touches;
    if (!touches || touches.length < 2) {
      pinchLastCenter = null;
      pinchLastDist = 0;
    }
  }

  stage.on("wheel", handleWheel);
  stage.on("mousedown touchstart", handleStagePointerDown);
  stage.on("touchmove", handlePinchMove);
  stage.on("touchend touchcancel", handlePinchEnd);

  stage.on("click tap", function (e) {
    if (e.target !== stage) {
      return;
    }
    if (suppressStageClick) {
      suppressStageClick = false;
      return;
    }
    wireManager.clearWireSelection();
    wireManager.clearPendingHighlight();
    wireLayer.batchDraw();
    componentLayer.batchDraw();
  });

  window.addEventListener("keydown", function (evt) {
    if ((evt.metaKey || evt.ctrlKey) && (evt.key === "z" || evt.key === "Z")) {
      if (!evt.shiftKey) {
        evt.preventDefault();
        runUndo();
      }
      return;
    }

    if (mode !== "lab") {
      return;
    }
    if (evt.key === "Delete" || evt.key === "Backspace") {
      if (wireManager.removeSelectedWire()) {
        evt.preventDefault();
      }
    }
    if (evt.key === "Escape") {
      wireManager.clearPendingHighlight();
      wireManager.clearWireSelection();
      wireLayer.batchDraw();
      componentLayer.batchDraw();
    }
  });

  /**
   * Resizes the stage to the available space inside the host.
   */
  function handleResize() {
    syncToolbarHeight();
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 52;
    stage.width(host.clientWidth || window.innerWidth);
    stage.height(Math.max(200, (host.clientHeight || window.innerHeight) - toolbarHeight));
    syncContentBounds();
    setView(view);
    wireManager.updateWirePositions();
    stage.batchDraw();
  }

  window.addEventListener("resize", handleResize);

  syncModeButtons();
  setWireColor(config.defaultWireColor);
  syncZoomLabel();
  ensureComponents();
  showDemoCircuit();
}
