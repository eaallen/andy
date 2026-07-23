/**
 * Homepage Circuit Builder Generator demo — sample diagram → fake AI wait → live lab.
 */
(function () {
  /** @type {Record<string, { label: string; image: string; yaml: string }>} */
  const SAMPLES = {
    "single-pole": {
      label: "Single-Pole Lamp Lab",
      image: "/demo/single-pole.svg",
      yaml: "/labs/single-pole-lamp.yaml",
    },
    "three-way": {
      label: "Three-Way Lamp Lab",
      image: "/demo/three-way.svg",
      yaml: "/labs/three-way-lamp.yaml",
    },
    doorbell: {
      label: "Doorbell Demo Lab",
      image: "/demo/doorbell.svg",
      yaml: "/labs/doorbell.yaml",
    },
  };

  const THINKING_LINES = [
    "Reading the diagram…",
    "Identifying devices and terminals…",
    "Drafting lab components…",
    "Wiring the reference circuit…",
    "Almost ready…",
  ];

  const root = document.querySelector("[data-cbg]");
  if (!(root instanceof HTMLElement)) return;

  const pickStep = root.querySelector('[data-step="pick"]');
  const thinkingStep = root.querySelector('[data-step="thinking"]');
  const resultStep = root.querySelector('[data-step="result"]');
  const generateBtn = root.querySelector("[data-generate]");
  const resetBtn = root.querySelector("[data-reset]");
  const statusEl = root.querySelector("[data-thinking-status]");
  const titleEl = root.querySelector("[data-result-title]");
  const labMountEl = root.querySelector("[data-lab-mount]");
  const yamlEl = root.querySelector("[data-yaml]");

  if (
    !(pickStep instanceof HTMLElement) ||
    !(thinkingStep instanceof HTMLElement) ||
    !(resultStep instanceof HTMLElement) ||
    !(generateBtn instanceof HTMLButtonElement) ||
    !(resetBtn instanceof HTMLButtonElement) ||
    !(statusEl instanceof HTMLElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(labMountEl instanceof HTMLElement) ||
    !(yamlEl instanceof HTMLElement)
  ) {
    console.error("Home demo missing required DOM nodes.");
    return;
  }

  /** @type {ReturnType<typeof setInterval> | null} */
  let thinkingTimer = null;
  /** @type {AbortController | null} */
  let runController = null;

  /**
   * Shows one demo step and hides the others.
   * @param {"pick" | "thinking" | "result"} step - Active step id.
   */
  function showStep(step) {
    pickStep.hidden = step !== "pick";
    thinkingStep.hidden = step !== "thinking";
    resultStep.hidden = step !== "result";
  }

  /**
   * Reads the currently selected sample id from the radio group.
   */
  function selectedSampleId() {
    const checked = root.querySelector('input[name="cbg-sample"]:checked');
    if (checked instanceof HTMLInputElement && SAMPLES[checked.value]) {
      return checked.value;
    }
    return "single-pole";
  }

  /**
   * Clears the thinking status interval if one is running.
   */
  function stopThinkingAnimation() {
    if (thinkingTimer !== null) {
      clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
  }

  /**
   * Cycles status copy while the fake AI “thinks.”
   */
  function startThinkingAnimation() {
    let index = 0;
    statusEl.textContent = THINKING_LINES[0];
    stopThinkingAnimation();
    thinkingTimer = setInterval(() => {
      index = Math.min(index + 1, THINKING_LINES.length - 1);
      statusEl.textContent = THINKING_LINES[index];
    }, 700);
  }

  /**
   * Waits for a delay that can be cancelled via AbortSignal.
   * @param {number} ms - Milliseconds to wait.
   * @param {AbortSignal} signal - Abort signal for cancellation.
   */
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const id = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(id);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }

  /**
   * Mounts an interactive Demo circuit from YAML into the preview panel.
   * @param {string} yaml - Andy lab YAML source.
   */
  function renderLab(yaml) {
    labMountEl.replaceChildren();
    const labApi = window.AndyCircuitLab;
    if (!labApi || typeof labApi.mountCircuitLab !== "function") {
      labMountEl.textContent = "Circuit lab failed to load.";
      return;
    }

    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    pre.setAttribute("height", "420");
    const code = document.createElement("code");
    code.textContent = yaml;
    pre.appendChild(code);
    labMountEl.appendChild(pre);
    labApi.mountCircuitLab(pre);
  }

  /**
   * Runs the demo: think → fetch YAML → show result.
   */
  async function runDemo() {
    if (runController) {
      runController.abort();
    }
    runController = new AbortController();
    const { signal } = runController;

    const sampleId = selectedSampleId();
    const sample = SAMPLES[sampleId];
    generateBtn.disabled = true;
    showStep("thinking");
    startThinkingAnimation();
    root.classList.add("is-thinking");

    try {
      const yamlPromise = fetch(sample.yaml, { signal }).then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load lab config (HTTP " + res.status + ")");
        }
        return res.text();
      });

      await delay(2800, signal);
      const yaml = await yamlPromise;

      stopThinkingAnimation();
      root.classList.remove("is-thinking");
      titleEl.textContent = sample.label;
      yamlEl.textContent = yaml;
      showStep("result");
      // Mount after the result panel is visible so Konva gets a real size.
      requestAnimationFrame(() => renderLab(yaml));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      stopThinkingAnimation();
      root.classList.remove("is-thinking");
      showStep("pick");
      statusEl.textContent = "Reading the diagram…";
      console.error(err);
      window.alert(
        err instanceof Error ? err.message : "Demo failed to load the lab.",
      );
    } finally {
      generateBtn.disabled = false;
    }
  }

  /**
   * Returns to the diagram picker and clears the last result.
   */
  function resetDemo() {
    if (runController) {
      runController.abort();
      runController = null;
    }
    stopThinkingAnimation();
    root.classList.remove("is-thinking");
    labMountEl.replaceChildren();
    yamlEl.textContent = "";
    const config = root.querySelector(".cbg-config");
    if (config instanceof HTMLDetailsElement) {
      config.open = false;
    }
    showStep("pick");
  }

  generateBtn.addEventListener("click", () => {
    void runDemo();
  });
  resetBtn.addEventListener("click", resetDemo);
})();
