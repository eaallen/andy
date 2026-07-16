import { describe, it, expect, beforeEach } from "vitest";
import {
  CIRCUIT_LAB_CSS,
  ensureCircuitLabStyles,
} from "../js/circuit-lab-styles.js";

describe("circuit-lab-styles", () => {
  beforeEach(() => {
    const existing = document.getElementById("circuit-lab-styles");
    if (existing) {
      existing.remove();
    }
  });

  it("injects a style element with the circuit-lab CSS once", () => {
    ensureCircuitLabStyles();
    ensureCircuitLabStyles();

    const styles = document.querySelectorAll("#circuit-lab-styles");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain("circuit-lab");
    expect(styles[0].textContent).toContain(".lab-toolbar");
    expect(styles[0].textContent).toBe(CIRCUIT_LAB_CSS);
  });
});
