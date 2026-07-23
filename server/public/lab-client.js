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
   * Resolves the lab entry from the ?lab= query param (defaults to first lab).
   */
  function currentLab() {
    const key = new URLSearchParams(location.search).get("lab");
    for (let i = 0; i < LABS.length; i += 1) {
      if (LABS[i].id === key) {
        return LABS[i];
      }
    }
    return LABS[0];
  }

  /**
   * Boots the selected lab into #lab-root.
   */
  async function main() {
    const labApi = window.AndyCircuitLab;
    if (!labApi || typeof labApi.scanAndMountLabs !== "function") {
      throw new Error("AndyCircuitLab failed to load (/andy.js).");
    }

    const lab = currentLab();
    document.title = lab.label + " — Andy";

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

    select.addEventListener("change", function () {
      const next = new URL(location.href);
      next.searchParams.set("lab", select.value);
      location.assign(next.toString());
    });

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

    const root = document.getElementById("lab-root");
    if (!root) {
      throw new Error("Missing #lab-root");
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
