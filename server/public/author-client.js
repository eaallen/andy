/**
 * Author page client — diagram upload, SSE generation, demo preview via AndyCircuitLab.
 */
(function () {
  const DRAFT_STORAGE_KEY = "andy:draftLabYaml";

  const form = document.getElementById("form");
  const dropEl = document.getElementById("drop");
  const imageInput = document.getElementById("image");
  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submit");
  const copyBtn = document.getElementById("copy");
  const openBtn = document.getElementById("openLab");
  const resultEl = document.getElementById("result");
  const demoPreviewEl = document.getElementById("demoPreview");
  const labMountEl = document.getElementById("labMount");
  const yamlEl = document.getElementById("yaml");
  const warningsEl = document.getElementById("warnings");
  const metaEl = document.getElementById("meta");
  const thumbEl = document.getElementById("thumb");
  const fileNameEl = document.getElementById("fileName");
  const fileInfoEl = document.getElementById("fileInfo");

  if (
    !(form instanceof HTMLFormElement) ||
    !(dropEl instanceof HTMLElement) ||
    !(imageInput instanceof HTMLInputElement) ||
    !(statusEl instanceof HTMLElement) ||
    !(submitBtn instanceof HTMLButtonElement) ||
    !(copyBtn instanceof HTMLButtonElement) ||
    !(openBtn instanceof HTMLButtonElement) ||
    !(resultEl instanceof HTMLElement) ||
    !(demoPreviewEl instanceof HTMLElement) ||
    !(labMountEl instanceof HTMLElement) ||
    !(yamlEl instanceof HTMLElement) ||
    !(warningsEl instanceof HTMLElement) ||
    !(metaEl instanceof HTMLElement) ||
    !(thumbEl instanceof HTMLImageElement) ||
    !(fileNameEl instanceof HTMLElement) ||
    !(fileInfoEl instanceof HTMLElement)
  ) {
    console.error("Author page missing required DOM nodes.");
    return;
  }

  let lastYaml = "";
  let thumbObjectUrl = "";
  let statusBase = "";
  let statusStartedAt = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let statusTimer = null;

  /**
   * Formats a byte size for the file info line.
   * @param {number} bytes - File size in bytes.
   */
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Mounts an interactive Demo circuit from generated YAML into the preview panel.
   * @param {string} yaml - Andy lab YAML source.
   */
  function renderDemoPreview(yaml) {
    labMountEl.replaceChildren();
    if (!yaml.trim()) {
      demoPreviewEl.classList.remove("is-visible");
      return;
    }

    const labApi = window.AndyCircuitLab;
    if (!labApi || typeof labApi.mountCircuitLab !== "function") {
      console.error("AndyCircuitLab failed to load (/andy.js).");
      return;
    }

    const pre = document.createElement("pre");
    pre.className = "circuit-lab";
    pre.setAttribute("height", "100%");
    const code = document.createElement("code");
    code.textContent = yaml;
    pre.appendChild(code);
    labMountEl.appendChild(pre);
    demoPreviewEl.classList.add("is-visible");
    labApi.mountCircuitLab(pre);
  }

  /**
   * Clears generated YAML, warnings, and demo preview after a new image is chosen.
   */
  function resetGeneratedResult() {
    lastYaml = "";
    yamlEl.textContent = "";
    metaEl.textContent = "";
    warningsEl.replaceChildren();
    renderDemoPreview("");
    copyBtn.disabled = true;
    openBtn.disabled = true;
  }

  /**
   * Shows a local preview of the selected diagram image and resets prior YAML.
   * @param {File | null | undefined} file - Selected image file from the input.
   */
  function previewSelectedImage(file) {
    if (thumbObjectUrl) {
      URL.revokeObjectURL(thumbObjectUrl);
      thumbObjectUrl = "";
    }
    resetGeneratedResult();
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      thumbEl.removeAttribute("src");
      dropEl.classList.remove("has-file");
      resultEl.classList.remove("is-visible");
      fileNameEl.textContent = "";
      fileInfoEl.textContent = "";
      return;
    }
    thumbObjectUrl = URL.createObjectURL(file);
    thumbEl.src = thumbObjectUrl;
    fileNameEl.textContent = file.name;
    fileInfoEl.textContent = `${formatBytes(file.size)} · ${file.type || "image"}`;
    dropEl.classList.add("has-file");
    resultEl.classList.add("is-visible");
    finishStatus("");
  }

  /**
   * Updates the status line and starts/refreshes the elapsed-seconds timer.
   * @param {string} message - Status text without elapsed suffix.
   */
  function setStatus(message) {
    statusBase = message;
    if (!statusTimer) {
      statusStartedAt = Date.now();
      statusTimer = setInterval(() => {
        const secs = Math.max(
          0,
          Math.round((Date.now() - statusStartedAt) / 1000),
        );
        statusEl.textContent = statusBase ? `${statusBase} (${secs}s)` : "";
      }, 1000);
    }
    const secs = Math.max(
      0,
      Math.round((Date.now() - statusStartedAt) / 1000),
    );
    statusEl.textContent = `${message} (${secs}s)`;
  }

  /**
   * Stops the elapsed timer and sets a final status (no seconds suffix).
   * @param {string} message - Final status text.
   * @param {boolean} [isError] - When true, styles as error.
   */
  function finishStatus(message, isError) {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
    statusBase = "";
    statusEl.classList.toggle("error", Boolean(isError));
    statusEl.textContent = message;
  }

  /**
   * Reads an SSE response body and invokes handlers for named events.
   * @param {Response} response - Fetch response with text/event-stream body.
   * @param {{ onProgress?: (data: { message?: string }) => void, onResult?: (data: Record<string, unknown>) => void, onError?: (data: { error?: string }) => void }} handlers
   */
  async function consumeSse(response, handlers) {
    if (!response.body) {
      throw new Error("No response body from server.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        if (!chunk.trim() || chunk.startsWith(":")) continue;
        let eventName = "message";
        const dataLines = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (!dataLines.length) continue;
        let data;
        try {
          data = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }
        if (eventName === "progress") handlers.onProgress?.(data);
        else if (eventName === "result") handlers.onResult?.(data);
        else if (eventName === "error") handlers.onError?.(data);
      }
    }
  }

  imageInput.addEventListener("change", () => {
    previewSelectedImage(imageInput.files?.[0]);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropEl.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropEl.classList.add("is-drag");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropEl.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropEl.classList.remove("is-drag");
    });
  });

  dropEl.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!(file instanceof File)) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    imageInput.files = transfer.files;
    previewSelectedImage(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.classList.remove("error");
    setStatus("Uploading image…");
    submitBtn.disabled = true;
    copyBtn.disabled = true;
    openBtn.disabled = true;

    const fd = new FormData(form);

    try {
      const res = await fetch("/api/diagrams/from-image?stream=1", {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }

      /** @type {Record<string, unknown> | null} */
      let result = null;
      /** @type {string | null} */
      let streamError = null;

      await consumeSse(res, {
        onProgress: (data) => {
          if (data?.message) setStatus(String(data.message));
        },
        onResult: (data) => {
          result = data;
        },
        onError: (data) => {
          streamError = data?.error
            ? String(data.error)
            : "Generation failed.";
        },
      });

      if (streamError) {
        throw new Error(streamError);
      }
      if (!result) {
        throw new Error("Server closed the stream without a result.");
      }

      lastYaml = String(result.yaml || "");
      yamlEl.textContent = lastYaml;
      metaEl.textContent = `${result.provider} · ${result.model}`;
      warningsEl.replaceChildren();
      for (const warning of result.warnings || []) {
        const li = document.createElement("li");
        li.textContent = String(warning);
        warningsEl.appendChild(li);
      }
      resultEl.classList.add("is-visible");
      renderDemoPreview(lastYaml);
      copyBtn.disabled = !lastYaml;
      openBtn.disabled = !lastYaml;
      finishStatus("Done.");
    } catch (err) {
      finishStatus(err instanceof Error ? err.message : String(err), true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(lastYaml);
    finishStatus("YAML copied.");
  });

  openBtn.addEventListener("click", () => {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, lastYaml);
    window.location.href = "/lab?lab=draft";
  });
})();
