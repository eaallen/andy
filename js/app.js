/* global Konva, createLayoutFromConfig, findTerminal, createWireManager,
   createCircuitSimulator, createSoundPlayer, createGrader, WIRE_COLORS,
   resolveCoord */

/**
 * Boots the doorbell circuit lab inside a host element using a YAML-derived config.
 * @param {HTMLElement} host - Root element that contains toolbar + stage markup.
 * @param {object} config - Normalized lab config from loadLabConfigFromElement.
 */
function bootCircuitLab(host, config) {
  let mode = "demo";
  let wireColor = "red";
  let components = null;
  let testingSequence = false;
  /** @type {Array<object>|null} */
  let savedLabWires = null;
  /** @type {Array<object>|null} */
  let savedLabHistory = null;

  const toolbar = host.querySelector("[data-lab-toolbar]");
  const hintEl = host.querySelector("[data-lab-hint]");
  const modeDemoBtn = host.querySelector("[data-lab-mode=\"demo\"]");
  const modeLabBtn = host.querySelector("[data-lab-mode=\"lab\"]");
  const btnTest = host.querySelector("[data-lab-action=\"test\"]");
  const btnCheck = host.querySelector("[data-lab-action=\"check\"]");
  const btnUndo = host.querySelector("[data-lab-action=\"undo\"]");
  const wireColorGroup = host.querySelector("[data-lab-wire-colors]");
  const stageContainer = host.querySelector("[data-lab-stage]");
  const titleEl = host.querySelector("[data-lab-title]");

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
   * Returns button components in document/config order for the test sequence.
   */
  function buttonList() {
    return componentList().filter(function (component) {
      return component && component.isSwitch;
    });
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

  const wireManager = createWireManager(wireLayer, {
    resolveTerminal: resolveTerminal,
    onHistoryChange: syncUndoButton,
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

  const simulator = createCircuitSimulator(getWires, getComponents);
  const grader = createGrader(simulator, getComponents);

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
      stage.container().style.cursor = "grab";
    });
    group.on("mouseleave", function () {
      stage.container().style.cursor = "default";
    });
    group.on("dragstart", function () {
      stage.container().style.cursor = "grabbing";
    });
    group.on("dragend", function () {
      stage.container().style.cursor = "grab";
    });

    if (group.terminals) {
      for (let i = 0; i < group.terminals.length; i += 1) {
        bindTerminal(group.terminals[i]);
      }
    }

    if (group.isSwitch) {
      bindButton(group);
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
   * Binds slide + click handling on a terminal.
   * @param {object} terminal - Terminal metadata.
   */
  function bindTerminal(terminal) {
    const handle = terminal.handle || terminal.node;

    handle.on("terminalslide", function () {
      wireManager.updateWirePositions();
    });

    handle.on("click tap", function (evt) {
      evt.cancelBubble = true;
      if (terminal.didSlide) {
        terminal.didSlide = false;
        return;
      }
      wireManager.clearWireSelection();
      if (mode === "lab") {
        if (!wireManager.hasPendingTerminal()) {
          const color = terminal.wireColor;
          if (color && wireColorGroup.querySelector('[data-color="' + color + '"]')) {
            setWireColor(color);
          }
        }
        wireManager.handleTerminalClick(terminal, wireColor, true);
      }
    });

    handle.on("mouseenter", function () {
      stage.container().style.cursor = mode === "lab" ? "crosshair" : "grab";
    });
    handle.on("mouseleave", function () {
      stage.container().style.cursor = "default";
    });
  }

  /**
   * Visually marks a button as pressed or released.
   * @param {Konva.Group} button - Button component.
   * @param {boolean} pressed - Whether the button is down.
   */
  function setButtonPressedVisual(button, pressed) {
    button.isPressed = pressed;
    const shell = button.findOne(".component-shell") || button.findOne("Rect");
    if (shell) {
      shell.fill(pressed ? "#dbeafe" : "#ffffff");
      shell.stroke(pressed ? "#2563eb" : "#a1a1aa");
    }
    componentLayer.batchDraw();
  }

  /**
   * Runs simulation for a pressed button and plays matching sounds.
   * @param {Konva.Group} button - Pressed button component.
   */
  function handleButtonPress(button) {
    const result = simulator.energizeForButton(button.buttonKey);
    simulator.highlightPath(result.pathKeys, true);
    componentLayer.batchDraw();

    const tones = ["front", "rear"];
    for (let i = 0; i < tones.length; i += 1) {
      if (result.energized[tones[i]]) {
        sounds.playChime(tones[i]);
      }
    }
  }

  /**
   * Clears path highlight when a button is released.
   */
  function handleButtonRelease() {
    simulator.highlightPath({}, false);
    componentLayer.batchDraw();
  }

  /**
   * Binds press/release interaction on a doorbell button.
   * @param {Konva.Group} button - Button component.
   */
  function bindButton(button) {
    button.on("mousedown touchstart", function (evt) {
      if (isTerminalTarget(evt.target)) {
        return;
      }
      // Do not cancelBubble — the white box must still start a group drag.
      setButtonPressedVisual(button, true);
      handleButtonPress(button);
    });

    button.on("dragstart", function () {
      if (!button.isPressed) {
        return;
      }
      setButtonPressedVisual(button, false);
      handleButtonRelease();
    });

    button.on("mouseup touchend mouseleave", function () {
      if (!button.isPressed) {
        return;
      }
      setButtonPressedVisual(button, false);
      handleButtonRelease();
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

    const swatches = wireColorGroup.querySelectorAll(".wire-swatch");
    for (let i = 0; i < swatches.length; i += 1) {
      swatches[i].disabled = isDemo;
    }
  }

  /**
   * Updates the active wire color swatch.
   * @param {string} colorKey - red, gray, blue, or green.
   */
  function setWireColor(colorKey) {
    if (!WIRE_COLORS[colorKey]) {
      return;
    }
    wireColor = colorKey;
    const swatches = wireColorGroup.querySelectorAll(".wire-swatch");
    for (let i = 0; i < swatches.length; i += 1) {
      const active = swatches[i].getAttribute("data-color") === colorKey;
      swatches[i].classList.toggle("active", active);
      swatches[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  /**
   * Runs an automated press of each doorbell button in sequence.
   */
  function runTestSequence() {
    if (testingSequence || !components) {
      return;
    }

    const sequence = buttonList();
    if (sequence.length === 0) {
      return;
    }

    testingSequence = true;
    const sequenceId = Date.now();
    runTestSequence.activeId = sequenceId;
    btnTest.disabled = true;
    setHint("Testing: pressing buttons in sequence…");

    let index = 0;

    /**
     * Returns whether this test run is still the active one.
     */
    function isActive() {
      return testingSequence && runTestSequence.activeId === sequenceId && components;
    }

    /**
     * Advances to the next button in the test sequence.
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

      const button = sequence[index];
      index += 1;
      setButtonPressedVisual(button, true);
      handleButtonPress(button);

      window.setTimeout(function () {
        if (!isActive()) {
          testingSequence = false;
          btnTest.disabled = false;
          return;
        }
        setButtonPressedVisual(button, false);
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

  wireColorGroup.addEventListener("click", function (evt) {
    const target = evt.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const color = target.getAttribute("data-color");
    if (color && mode === "lab") {
      setWireColor(color);
    }
  });

  stage.on("click tap", function () {
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
    wireManager.updateWirePositions();
    stage.batchDraw();
  }

  window.addEventListener("resize", handleResize);

  syncModeButtons();
  setWireColor("red");
  ensureComponents();
  showDemoCircuit();
}
