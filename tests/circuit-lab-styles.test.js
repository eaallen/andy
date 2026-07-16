import { describe, it, expect, beforeEach } from "vitest";
import {
  CIRCUIT_LAB_CSS,
  CIRCUIT_LAB_DOCUMENT_CSS,
  ensureCircuitLabDocumentStyles,
  ensureCircuitLabStyles,
} from "../js/circuit-lab-styles.js";
import "../js/circuit-lab-element.js";

describe("circuit-lab-styles", () => {
  beforeEach(() => {
    const existingUi = document.getElementById("circuit-lab-styles");
    if (existingUi) {
      existingUi.remove();
    }
    const existingDoc = document.getElementById("circuit-lab-document-styles");
    if (existingDoc) {
      existingDoc.remove();
    }
  });

  it("injects document-level script-hiding styles once", () => {
    ensureCircuitLabDocumentStyles();
    ensureCircuitLabDocumentStyles();

    const styles = document.querySelectorAll("#circuit-lab-document-styles");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe(CIRCUIT_LAB_DOCUMENT_CSS);
    expect(styles[0].textContent).toContain('circuit-lab > script[type="text/yaml"]');
  });

  it("injects a document style element with the circuit-lab CSS once", () => {
    ensureCircuitLabStyles();
    ensureCircuitLabStyles();

    const styles = document.querySelectorAll("#circuit-lab-styles");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain(":host");
    expect(styles[0].textContent).toContain(".lab-toolbar");
    expect(styles[0].textContent).toBe(CIRCUIT_LAB_CSS);
  });

  it("injects UI styles into a shadow root without touching document.head", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    ensureCircuitLabStyles(shadow);
    ensureCircuitLabStyles(shadow);

    expect(shadow.querySelectorAll("style[data-circuit-lab-styles]")).toHaveLength(1);
    expect(document.getElementById("circuit-lab-styles")).toBeNull();
    expect(shadow.querySelector("style").textContent).toBe(CIRCUIT_LAB_CSS);

    host.remove();
  });
});

describe("circuit-lab shadow DOM", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("renders toolbar UI inside an open shadow root", async () => {
    const host = document.createElement("circuit-lab");
    const script = document.createElement("script");
    script.type = "application/json";
    script.textContent = JSON.stringify({
      title: "Shadow Lab",
      margin: 40,
      passMessage: "ok",
      hints: { demo: "demo", lab: "lab" },
      components: [{ id: "power", type: "power", x: 40, y: 40 }],
      demo: { wires: [] },
    });
    host.appendChild(script);
    document.body.appendChild(host);

    await viWaitForBoot(host);

    expect(host.shadowRoot).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-toolbar]")).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-stage]")).toBeTruthy();
    expect(host.querySelector("[data-lab-toolbar]")).toBeNull();
    expect(host.shadowRoot.querySelector("style[data-circuit-lab-styles]")).toBeTruthy();
  });
});

/**
 * Waits until the circuit-lab element has finished its async boot.
 * @param {HTMLElement} host - circuit-lab element under test.
 */
async function viWaitForBoot(host) {
  for (let i = 0; i < 50; i += 1) {
    if (host.shadowRoot && host.shadowRoot.querySelector("[data-lab-stage]")) {
      return;
    }
    if (host.shadowRoot && host.shadowRoot.querySelector(".circuit-lab-error")) {
      throw new Error(host.shadowRoot.querySelector(".circuit-lab-error").textContent);
    }
    await new Promise(function (resolve) {
      setTimeout(resolve, 20);
    });
  }
  throw new Error("circuit-lab did not finish booting in time");
}
