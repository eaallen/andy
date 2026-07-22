/**
 * Grades a student circuit from normalized config.grading rules.
 * @param {object} simulator - Circuit simulator from createCircuitSimulator.
 * @param {() => object} getComponents - Returns the current component map (config id → group).
 * @param {object|null} grading - Normalized config.grading (required, continuity, polarity, whenClosed).
 */
export function createGrader(simulator, getComponents, grading) {
  /**
   * Returns load ids that are currently energized.
   * @param {{ [loadId: string]: boolean }} energized - Energized map from simulate().
   */
  function litLoadIds(energized) {
    const lit = [];
    const ids = Object.keys(energized || {});
    for (let i = 0; i < ids.length; i += 1) {
      if (energized[ids[i]]) {
        lit.push(ids[i]);
      }
    }
    lit.sort();
    return lit;
  }

  /**
   * Returns whether two string arrays contain the same set of values.
   * @param {string[]} a - First list.
   * @param {string[]} b - Second list.
   */
  function sameIdSet(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    const left = a.slice().sort();
    const right = b.slice().sort();
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks that all required components are present on the stage.
   */
  function checkComponentsPresent() {
    if (!grading || !Array.isArray(grading.required)) {
      return [];
    }
    const components = getComponents();
    const missing = [];
    for (let i = 0; i < grading.required.length; i += 1) {
      const id = grading.required[i];
      if (!components[id]) {
        missing.push(id);
      }
    }
    return missing;
  }

  /**
   * Runs wire-only continuity checks from config.grading.continuity.
   */
  function checkContinuity() {
    const failures = [];
    if (!grading || !Array.isArray(grading.continuity)) {
      return failures;
    }
    for (let i = 0; i < grading.continuity.length; i += 1) {
      const check = grading.continuity[i];
      const from = simulator.resolveEndpoint(check.from);
      const to = simulator.resolveEndpoint(check.to);
      if (!simulator.areWiredTogether(from, to)) {
        failures.push(check.fail);
      }
    }
    return failures;
  }

  /**
   * Runs labeled hot/neutral polarity checks from config.grading.polarity.
   * Loads may still light when reversed; this is a best-practice deduction.
   */
  function checkPolarity() {
    const failures = [];
    if (!grading || !Array.isArray(grading.polarity)) {
      return failures;
    }
    for (let i = 0; i < grading.polarity.length; i += 1) {
      const check = grading.polarity[i];
      if (!simulator.isLoadPolarityCorrect(check.load, check.closed)) {
        failures.push(check.fail);
      }
    }
    return failures;
  }

  /**
   * Checks that a set of closed switches energizes exactly the expected load ids.
   * Supports legacy `switch` (single id) or `closed` (id list; empty = all open/default).
   * @param {{ switch?: string, closed?: string[], energize: string[] }} rule - whenClosed rule from config.
   */
  function checkWhenClosed(rule) {
    const closedIds =
      Array.isArray(rule.closed) && rule.closed.length > 0
        ? rule.closed.slice()
        : rule.switch
          ? [rule.switch]
          : [];
    const result = simulator.simulate(closedIds);
    const lit = litLoadIds(result.energized);
    const expected = (rule.energize || []).slice().sort();
    const ok = sameIdSet(lit, expected);
    return {
      ok: ok,
      lit: lit,
      expected: expected,
      switchId: rule.switch || (closedIds.length ? closedIds.join("+") : "(none)"),
      closedIds: closedIds,
    };
  }

  /**
   * Builds a failure message for a failed whenClosed rule.
   * @param {{ ok: boolean, lit: string[], expected: string[], switchId: string, closedIds?: string[] }} check - checkWhenClosed result.
   */
  function whenClosedFailureMessage(check) {
    const label =
      check.closedIds && check.closedIds.length > 1
        ? "Closing [" + check.closedIds.join(", ") + "]"
        : check.closedIds && check.closedIds.length === 0
          ? "With all switches open/default"
          : "Closing " + check.switchId;
    if (check.lit.length === 0) {
      if (check.expected.length === 0) {
        return label + " should leave all loads off, but the check failed unexpectedly.";
      }
      return label + " does not energize [" + check.expected.join(", ") + "].";
    }
    return (
      label +
      " energized [" +
      check.lit.join(", ") +
      "] — expected [" +
      check.expected.join(", ") +
      "]."
    );
  }

  /**
   * Runs all grading rules and returns pass/fail with messages.
   */
  function grade() {
    const failures = [];

    if (!grading) {
      failures.push("This lab has no grading rules configured.");
      return { pass: false, failures: failures };
    }

    const missing = checkComponentsPresent();
    if (missing.length > 0) {
      failures.push("Missing components: " + missing.join(", "));
      return { pass: false, failures: failures };
    }

    const continuityFailures = checkContinuity();
    for (let i = 0; i < continuityFailures.length; i += 1) {
      failures.push(continuityFailures[i]);
    }

    const polarityFailures = checkPolarity();
    for (let p = 0; p < polarityFailures.length; p += 1) {
      failures.push(polarityFailures[p]);
    }

    const whenClosed = Array.isArray(grading.whenClosed) ? grading.whenClosed : [];
    for (let j = 0; j < whenClosed.length; j += 1) {
      const check = checkWhenClosed(whenClosed[j]);
      if (!check.ok) {
        failures.push(whenClosedFailureMessage(check));
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
    checkContinuity: checkContinuity,
    checkPolarity: checkPolarity,
    checkWhenClosed: checkWhenClosed,
  };
}
