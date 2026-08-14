/**
 * Lab picker shell — loads YAML and mounts AndyCircuitLab.
 */
(function () {
  const DRAFT_STORAGE_KEY = "andy:draftLabYaml";

  /** @type {{ id: string; src: string | null; label: string }[]} */
  const LABS = [
    { id: "doorbell", src: "/labs/doorbell.yaml", label: "Doorbell Demo" },
    {
      id: "single-pole-lamp",
      src: "/labs/single-pole-lamp.yaml",
      label: "Single-Pole Lamp",
    },
    {
      id: "three-way-lamp",
      src: "/labs/three-way-lamp.yaml",
      label: "Three-Way Lamp",
    },
    {
      id: "four-way-lamp",
      src: "/labs/four-way-lamp.yaml",
      label: "Four-Way Lamp",
    },
    {
      id: "gfci-downstream",
      src: "/labs/gfci-downstream.yaml",
      label: "GFCI Downstream",
    },
    {
      id: "multi-wire-branch",
      src: "/labs/multi-wire-branch.yaml",
      label: "Multi-Wire Branch",
    },
    { id: "draft", src: null, label: "AI Draft (from image)" },
  ];

  /**
   * Reads LMS launch context embedded by the lab page (absent on public /lab).
   * 
   * Note: Reading the lab context directly from the dom seems like a bad idea to me. 
   * I would think there is another context we can use to make this work better. 
   */
  function readLabContext() {
    const el = document.getElementById("andy-lab-context");
    if (!el || !el.textContent) {
      return null;
    }
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  }

  /**
   * Resolves the lab entry from LMS context or the ?lab= query param.
   * @param {{ labId?: string | null } | null} ctx - Embedded LMS context.
   */
  function currentLab(ctx) {
    const key =
      (ctx && ctx.labId) || new URLSearchParams(location.search).get("lab");
    for (let i = 0; i < LABS.length; i += 1) {
      if (LABS[i].id === key) {
        return LABS[i];
      }
    }
    return LABS[0];
  }

  /**
   * Shows grade passback status next to the lab picker.
   * @param {string} text - Status message.
   * @param {boolean} [ok] - True for success styling.
   */
  function setGradeStatus(text, ok) {
    const status = document.getElementById("voshi-grade-status");
    if (!(status instanceof HTMLElement)) {
      return;
    }
    status.hidden = !text;
    status.textContent = text;
    status.classList.toggle("is-ok", Boolean(ok));
    status.classList.toggle("is-err", Boolean(text) && !ok);
  }

  /**
   * Sends a passing score to Andy's Voshi grade endpoint (server holds the API key).
   */
  function submitPassingGrade() {
    setGradeStatus("Sending grade…", true);
    fetch("/api/voshi/grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ score: 1 }),
    })
      .then(async function (response) {
        const body = await response.json();
        return { ok: response.ok, body: body };
      })
      .then(function (result) {
        if (!result.ok) {
          const message =
            result.body && result.body.error
              ? result.body.error
              : "Grade could not be sent.";
          setGradeStatus(message, false);
          return;
        }
        setGradeStatus("Grade sent to the gradebook.", true);
      })
      .catch(function () {
        setGradeStatus("Grade could not be sent.", false);
      });
  }

  /**
   * Boots the selected lab into #lab-root.
   */
  async function main() {
    const labApi = window.AndyCircuitLab;
    if (!labApi || typeof labApi.scanAndMountLabs !== "function") {
      throw new Error("AndyCircuitLab failed to load (/andy.js).");
    }

    const ctx = readLabContext();
    const lab = currentLab(ctx);
    document.title = lab.label + " — Andy";

    if (ctx && ctx.labId) {
      const next = new URL(location.href);
      next.searchParams.set("lab", ctx.labId);
      history.replaceState(null, "", next);
    }

    const select = document.getElementById("lab-select");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Missing #lab-select");
    }

    for (let i = 0; i < LABS.length; i += 1) {
      const option = document.createElement("option");
      option.value = LABS[i].id;
      option.textContent = LABS[i].label;
      if (LABS[i].id === lab.id) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    if (ctx && ctx.lockPicker) {
      select.disabled = true;
    } else {
      select.addEventListener("change", function () {
        const next = new URL(location.href);
        next.searchParams.set("lab", select.value);
        location.assign(next.toString());
      });
    }

    const root = document.getElementById("lab-root");
    if (!root) {
      throw new Error("Missing #lab-root");
    }

    if (ctx && ctx.canGrade) {
      root.addEventListener("andy:lab-check", function (event) {
        const detail = event instanceof CustomEvent ? event.detail : null;
        if (detail && detail.pass) {
          submitPassingGrade();
        }
      });
    }

    let yaml = "";
    if (lab.id === "draft") {
      yaml = sessionStorage.getItem(DRAFT_STORAGE_KEY) || "";
      if (!yaml.trim()) {
        throw new Error(
          "No AI draft YAML in session. Generate one at /author first.",
        );
      }
    } else {
      const response = await fetch(lab.src);
      if (!response.ok) {
        throw new Error(
          "Failed to load " + lab.src + " (HTTP " + response.status + ")",
        );
      }
      yaml = await response.text();
    }

    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    const code = document.createElement("code");
    code.textContent = yaml;
    pre.appendChild(code);
    root.appendChild(pre);

    labApi.scanAndMountLabs(root);
  }

  main().catch(function (err) {
    const root = document.getElementById("lab-root");
    if (root) {
      root.textContent =
        err instanceof Error ? err.message : String(err);
    }
    console.error(err);
  });
})();
