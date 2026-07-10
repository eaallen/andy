/* global Konva, createDefaultLayout, findTerminal, createWireManager,
   createCircuitSimulator, createSoundPlayer, createGrader, WIRE_COLORS */

(function () {
  const HINT_DEMO =
    "Demo: press Front for one sound; Rear and Side share the other (as in a typical residential chime). Double-click a wire to bend it; Undo (Ctrl/Cmd+Z) reverses wire edits.";
  const HINT_LAB =
    "Lab: wire so Front has its own path and Rear + Side share the Rear chime. Color matches the terminal you click. Undo reverses edits. Then Check to grade.";

  let mode = "demo";
  let wireColor = "red";
  let components = null;
  let testingSequence = false;
  /** @type {Array<object>|null} */
  let savedLabWires = null;
  /** @type {Array<object>|null} */
  let savedLabHistory = null;

  const toolbar = document.getElementById("toolbar");
  const hintEl = document.getElementById("hint");
  const modeDemoBtn = document.getElementById("mode-demo");
  const modeLabBtn = document.getElementById("mode-lab");
  const btnTest = document.getElementById("btn-test");
  const btnCheck = document.getElementById("btn-check");
  const btnUndo = document.getElementById("btn-undo");
  const wireColorGroup = document.getElementById("wire-colors");

  /**
   * Syncs CSS variable for stage height under the toolbar.
   */
  function syncToolbarHeight() {
    const height = toolbar ? toolbar.offsetHeight : 52;
    document.documentElement.style.setProperty("--toolbar-height", height + "px");
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
    container: "container",
    width: window.innerWidth,
    height: Math.max(200, window.innerHeight - (toolbar ? toolbar.offsetHeight : 52)),
  });

  const wireLayer = new Konva.Layer();
  const componentLayer = new Konva.Layer();
  stage.add(wireLayer);
  stage.add(componentLayer);

  const sounds = createSoundPlayer();

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
    const list = [
      components.power,
      components.transformer,
      components.chime,
      components.terminalBlock,
      components.buttonFront,
      components.buttonRear,
      components.buttonSide,
    ];
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
   * @param {string} fromComponent - Source component key.
   * @param {string} fromId - Source terminal id.
   * @param {string} toComponent - Target component key.
   * @param {string} toId - Target terminal id.
   * @param {string} colorKey - Wire color key.
   */
  function refWire(fromComponent, fromId, toComponent, toId, colorKey) {
    wireManager.addWire(
      term(fromComponent, fromId),
      term(toComponent, toId),
      colorKey,
      { selectable: false, recordHistory: false }
    );
  }

  /**
   * Wires the correct reference circuit (Rear and Side share the Rear chime).
   */
  function loadReferenceWires() {
    // 120V: power → terminal block → transformer
    refWire("power", "l1", "terminalBlock", "l1", "blue");
    refWire("power", "n", "terminalBlock", "n", "black");
    refWire("power", "g", "terminalBlock", "g", "green");
    refWire("terminalBlock", "l1", "transformer", "pri-l1", "blue");
    refWire("terminalBlock", "n", "transformer", "pri-n", "black");
    refWire("terminalBlock", "g", "transformer", "pri-g", "green");

    // 24V: transformer hot → chime Trans; transformer COM → TB COM → buttons
    refWire("transformer", "sec-hot", "chime", "trans", "red");
    refWire("transformer", "sec-com", "terminalBlock", "com", "black");
    refWire("terminalBlock", "com", "buttonFront", "com", "black");
    refWire("terminalBlock", "com", "buttonRear", "com", "black");
    refWire("terminalBlock", "com", "buttonSide", "com", "black");

    // Front has its own path; Rear and Side join at the terminal block to chime Rear
    refWire("buttonFront", "sig", "terminalBlock", "sig-f", "red");
    refWire("terminalBlock", "sig-f", "chime", "front", "red");
    refWire("buttonRear", "sig", "terminalBlock", "sig-r", "red");
    refWire("buttonSide", "sig", "terminalBlock", "sig-s", "red");
    refWire("terminalBlock", "sig-s", "terminalBlock", "sig-r", "red");
    refWire("terminalBlock", "sig-r", "chime", "rear", "red");
  }

  /**
   * Creates components once and keeps them across Demo/Lab switches.
   */
  function ensureComponents() {
    if (components) {
      return;
    }

    components = createDefaultLayout(stage.width(), stage.height());

    const list = [
      components.chime,
      components.transformer,
      components.terminalBlock,
      components.power,
      components.buttonFront,
      components.buttonRear,
      components.buttonSide,
    ];

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
    setHint(HINT_DEMO);
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
    setHint(HINT_LAB);
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
   * Binds click handling for wire drawing on a terminal.
   * @param {object} terminal - Terminal metadata.
   */
  function bindTerminal(terminal) {
    terminal.node.on("click tap", function (evt) {
      evt.cancelBubble = true;
      wireManager.clearWireSelection();
      if (mode === "lab") {
        // Match palette to the terminal when starting a new wire.
        if (!wireManager.hasPendingTerminal()) {
          const color = terminal.wireColor;
          if (color && color !== "gray" && WIRE_COLORS[color]) {
            setWireColor(color);
          }
        }
        wireManager.handleTerminalClick(terminal, wireColor, true);
      }
    });

    terminal.node.on("mouseenter", function () {
      stage.container().style.cursor = mode === "lab" ? "crosshair" : "default";
    });
    terminal.node.on("mouseleave", function () {
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
    const shell = button.findOne("Rect");
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
      if (evt.target && evt.target.name && evt.target.name() === "terminal") {
        return;
      }
      evt.cancelBubble = true;
      setButtonPressedVisual(button, true);
      handleButtonPress(button);
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
   * @param {string} colorKey - red, black, blue, or green.
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

    testingSequence = true;
    const sequenceId = Date.now();
    runTestSequence.activeId = sequenceId;
    btnTest.disabled = true;
    setHint("Testing: pressing Front, Rear, then Side…");

    const sequence = [
      components.buttonFront,
      components.buttonRear,
      components.buttonSide,
    ];
    let index = 0;

    /**
     * Returns whether this test run is still the active one.
     */
    function isActive() {
      return (
        testingSequence &&
        runTestSequence.activeId === sequenceId &&
        components &&
        sequence[0] &&
        sequence[0] === components.buttonFront
      );
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
        setHint(mode === "demo" ? HINT_DEMO : HINT_LAB);
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
      setHint("Pass — Front has its own chime; Rear and Side share the Rear chime.", "pass");
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
   * Resizes the stage to the available viewport under the toolbar.
   */
  function handleResize() {
    syncToolbarHeight();
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 52;
    stage.width(window.innerWidth);
    stage.height(Math.max(200, window.innerHeight - toolbarHeight));
    wireManager.updateWirePositions();
    stage.batchDraw();
  }

  window.addEventListener("resize", handleResize);

  syncModeButtons();
  setWireColor("red");
  ensureComponents();
  showDemoCircuit();
})();
