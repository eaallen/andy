import { TERMINAL_ROLES, COMPONENT_TYPES } from "./components.js";

/**
 * Grades a student doorbell circuit against functional rules.
 * Front has its own chime path; Rear and Side share the Rear chime path.
 * @param {object} simulator - Circuit simulator from createCircuitSimulator.
 * @param {() => object} getComponents - Returns the current component map.
 */
export function createGrader(simulator, getComponents) {
  /**
   * Checks that all required components are present on the stage.
   */
  function checkComponentsPresent() {
    const components = getComponents();
    const required = [
      { key: "power", type: COMPONENT_TYPES.POWER, label: "Power source" },
      { key: "transformer", type: COMPONENT_TYPES.TRANSFORMER, label: "Transformer" },
      { key: "chime", type: COMPONENT_TYPES.CHIME, label: "Chime" },
      { key: "terminalBlock", type: COMPONENT_TYPES.TERMINAL_BLOCK, label: "Terminal block" },
      { key: "buttonFront", type: COMPONENT_TYPES.BUTTON, label: "Front button" },
      { key: "buttonRear", type: COMPONENT_TYPES.BUTTON, label: "Rear button" },
      { key: "buttonSide", type: COMPONENT_TYPES.BUTTON, label: "Side button" },
    ];

    const missing = [];
    for (let i = 0; i < required.length; i += 1) {
      const item = required[i];
      const component = components[item.key];
      if (!component || component.componentType !== item.type) {
        missing.push(item.label);
      }
    }

    return missing;
  }

  /**
   * Checks that transformer 24V hot reaches the chime Trans terminal.
   */
  function checkTransPowered() {
    const components = getComponents();
    const hot = simulator.findTerminalByRole(
      components.transformer,
      TERMINAL_ROLES.HOT_24V
    );
    const trans = simulator.findTerminalByRole(
      components.chime,
      TERMINAL_ROLES.CHIME_TRANS
    );
    return simulator.areWiredTogether(hot, trans);
  }

  /**
   * Expected chime tone(s) for a pressed button.
   * @param {"front" | "rear" | "side"} buttonKey - Button under test.
   */
  function expectedTone(buttonKey) {
    if (buttonKey === "front") {
      return "front";
    }
    // Rear and Side share the Rear chime.
    return "rear";
  }

  /**
   * Checks that pressing one button energizes only the expected chime tone.
   * @param {"front" | "rear" | "side"} buttonKey - Button under test.
   */
  function checkButtonIsolation(buttonKey) {
    const result = simulator.energizeForButton(buttonKey);
    const energized = result.energized;
    const expected = expectedTone(buttonKey);
    const lit = [];

    if (energized.front) {
      lit.push("front");
    }
    if (energized.rear) {
      lit.push("rear");
    }

    const ok = lit.length === 1 && lit[0] === expected;
    return {
      ok: ok,
      lit: lit,
      expected: expected,
      transPowered: result.transPowered,
    };
  }

  /**
   * Runs all grading rules and returns pass/fail with messages.
   */
  function grade() {
    const failures = [];
    const missing = checkComponentsPresent();

    if (missing.length > 0) {
      failures.push("Missing components: " + missing.join(", "));
      return { pass: false, failures: failures };
    }

    if (!checkTransPowered()) {
      failures.push("Chime Trans is not powered from the transformer 24V hot.");
    }

    const buttons = ["front", "rear", "side"];
    for (let i = 0; i < buttons.length; i += 1) {
      const key = buttons[i];
      const check = checkButtonIsolation(key);
      if (!check.ok) {
        if (check.lit.length === 0) {
          failures.push(
            "Pressing " +
              key +
              " does not energize the " +
              check.expected +
              " chime path."
          );
        } else {
          failures.push(
            "Pressing " +
              key +
              " energized [" +
              check.lit.join(", ") +
              "] — expected only " +
              check.expected +
              "."
          );
        }
      }
    }

    return {
      pass: failures.length === 0,
      failures: failures,
    };
  }

  return {
    grade: grade,
    checkComponentsPresent: checkComponentsPresent,
    checkTransPowered: checkTransPowered,
    checkButtonIsolation: checkButtonIsolation,
  };
}
