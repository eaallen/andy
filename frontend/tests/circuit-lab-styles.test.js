import { describe, it, expect, beforeEach } from "vitest";
import {
  CIRCUIT_LAB_CSS,
  ensureCircuitLabStyles,
} from "../js/circuit-lab-styles.js";
import { mountCircuitLab, scanAndMountLabs } from "../js/circuit-lab.js";

describe("circuit-lab-styles", () => {
  beforeEach(() => {
    const existingUi = document.getElementById("circuit-lab-styles");
    if (existingUi) {
      existingUi.remove();
    }
  });

  it("injects a document style element with the circuit-lab CSS once", () => {
    ensureCircuitLabStyles();
    ensureCircuitLabStyles();

    const styles = document.querySelectorAll("#circuit-lab-styles");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain(":host");
    expect(styles[0].textContent).toContain(".lab-toolbar");
    expect(styles[0].textContent).toContain(".wire-menu");
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

describe("circuit-lab pre mount", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("replaces pre.circuit-lab with a shadow host and toolbar UI", () => {
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = JSON.stringify({
      title: "Shadow Lab",
      margin: 40,
      passMessage: "ok",
      hints: { demo: "demo", lab: "lab" },
      components: [{ id: "power", type: "power", x: 40, y: 40 }],
      demo: { wires: [] },
    });
    pre.appendChild(code);
    document.body.appendChild(pre);

    const host = mountCircuitLab(pre);

    expect(document.querySelector("pre.circuit-lab")).toBeNull();
    expect(host).toBeTruthy();
    expect(host.getAttribute("data-circuit-lab-mounted")).toBe("");
    expect(host.shadowRoot).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-toolbar]")).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-stage]")).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-zoom]")).toBeTruthy();
    expect(host.shadowRoot.querySelector("[data-lab-zoom-label]")).toBeTruthy();
    expect(host.querySelector("[data-lab-toolbar]")).toBeNull();
    expect(host.shadowRoot.querySelector("style[data-circuit-lab-styles]")).toBeTruthy();
    expect(host.shadowRoot.querySelector("style").textContent).toContain("touch-action: none");
  });

  it("shows a config error for empty pre.circuit-lab blocks", () => {
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = "   ";
    pre.appendChild(code);
    document.body.appendChild(pre);

    const host = mountCircuitLab(pre);

    expect(host.shadowRoot.querySelector(".circuit-lab-error")).toBeTruthy();
    expect(host.shadowRoot.querySelector(".circuit-lab-error").textContent).toMatch(
      /inline YAML/i
    );
  });

  it("scanAndMountLabs mounts every pre.circuit-lab under a root", () => {
    const root = document.createElement("div");
    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = JSON.stringify({
      title: "Scanned Lab",
      margin: 40,
      passMessage: "ok",
      hints: { demo: "demo", lab: "lab" },
      components: [{ id: "power", type: "power", x: 40, y: 40 }],
      demo: { wires: [] },
    });
    pre.appendChild(code);
    root.appendChild(pre);
    document.body.appendChild(root);

    const hosts = scanAndMountLabs(root);

    expect(hosts).toHaveLength(1);
    expect(root.querySelector("pre.circuit-lab")).toBeNull();
    expect(hosts[0].shadowRoot.querySelector("[data-lab-stage]")).toBeTruthy();
  });
});
