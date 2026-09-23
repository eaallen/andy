const CLOSE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  "</svg>";

const MINIMIZE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M4 8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  "</svg>";

const RESTORE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>' +
  "</svg>";

const VARIANT_CLASS = {
  success: "lab-messages-panel--success",
  failure: "lab-messages-panel--failure",
  info: "lab-messages-panel--info",
};

const PANEL_MARGIN = 8;

/**
 * Normalizes a panel variant to a supported value.
 * @param {string|undefined} variant - Requested variant.
 */
function resolveVariant(variant) {
  if (variant === "success" || variant === "failure" || variant === "info") {
    return variant;
  }
  return "info";
}

/**
 * Clamps a value into [min, max].
 * @param {number} value - Value to clamp.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a dismissable, draggable messages panel pinned to the bottom-right of a mount.
 * @param {HTMLElement} mount - Parent that positions relatively (circuit-lab UI root).
 */
export function createMessagesPanel(mount) {
  const el = document.createElement("aside");
  el.className = "lab-messages-panel";
  el.setAttribute("data-lab-messages", "");
  el.hidden = true;

  const header = document.createElement("header");
  header.className = "lab-messages-header";

  const titleEl = document.createElement("h2");
  titleEl.className = "lab-messages-title";
  titleEl.setAttribute("data-lab-messages-title", "");

  const actions = document.createElement("div");
  actions.className = "lab-messages-actions";

  const minimizeBtn = document.createElement("button");
  minimizeBtn.type = "button";
  minimizeBtn.className = "lab-messages-minimize";
  minimizeBtn.setAttribute("aria-label", "Minimize message");
  minimizeBtn.title = "Minimize";
  minimizeBtn.innerHTML = MINIMIZE_ICON;

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "lab-messages-dismiss";
  dismissBtn.setAttribute("aria-label", "Dismiss message");
  dismissBtn.title = "Dismiss";
  dismissBtn.innerHTML = CLOSE_ICON;

  actions.appendChild(minimizeBtn);
  actions.appendChild(dismissBtn);
  header.appendChild(titleEl);
  header.appendChild(actions);

  const bodyEl = document.createElement("div");
  bodyEl.className = "lab-messages-body";
  bodyEl.setAttribute("data-lab-messages-body", "");

  el.appendChild(header);
  el.appendChild(bodyEl);
  mount.appendChild(el);

  /** @type {{ pointerId: number, offsetX: number, offsetY: number }|null} */
  let drag = null;
  let hasCustomPosition = false;
  let minimized = false;

  /**
   * Clears variant classes and live-region role from the panel.
   */
  function clearVariantClasses() {
    el.classList.remove(
      VARIANT_CLASS.success,
      VARIANT_CLASS.failure,
      VARIANT_CLASS.info,
    );
    el.removeAttribute("role");
    el.removeAttribute("aria-live");
  }

  /**
   * Restores the default bottom-right placement.
   */
  function resetPosition() {
    hasCustomPosition = false;
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.maxHeight = "";
  }

  /**
   * Syncs minimized chrome (body visibility + toggle label/icon).
   * When restoring, keeps the minimized bar's bottom edge fixed so the panel
   * expands upward when there is not enough room below.
   * @param {boolean} nextMinimized - Whether the body should be collapsed.
   */
  function setMinimized(nextMinimized) {
    const restoring = minimized && !nextMinimized;
    let anchorBottom = null;
    let anchorLeft = null;
    if (restoring) {
      const mountRect = mount.getBoundingClientRect();
      const panelRect = el.getBoundingClientRect();
      anchorBottom = panelRect.bottom - mountRect.top;
      anchorLeft = panelRect.left - mountRect.left;
    }

    minimized = nextMinimized;
    el.classList.toggle("lab-messages-panel--minimized", minimized);
    bodyEl.hidden = minimized;
    if (minimized) {
      minimizeBtn.setAttribute("aria-label", "Restore message");
      minimizeBtn.title = "Restore";
      minimizeBtn.innerHTML = RESTORE_ICON;
      el.style.maxHeight = "";
    } else {
      minimizeBtn.setAttribute("aria-label", "Minimize message");
      minimizeBtn.title = "Minimize";
      minimizeBtn.innerHTML = MINIMIZE_ICON;
    }

    if (restoring && anchorBottom != null && anchorLeft != null) {
      const available = Math.max(96, anchorBottom - PANEL_MARGIN);
      el.style.maxHeight = available + "px";
      // Flush layout so offsetHeight reflects the expanded body.
      void el.offsetHeight;
      setPosition(anchorLeft, anchorBottom - el.offsetHeight);
    }
  }

  /**
   * Places the panel at mount-local left/top, clamped inside the mount.
   * @param {number} left - Desired left offset in mount coordinates.
   * @param {number} top - Desired top offset in mount coordinates.
   */
  function setPosition(left, top) {
    const mountWidth = mount.clientWidth;
    const mountHeight = mount.clientHeight;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const maxLeft = Math.max(PANEL_MARGIN, mountWidth - width - PANEL_MARGIN);
    const maxTop = Math.max(PANEL_MARGIN, mountHeight - height - PANEL_MARGIN);
    const nextLeft = clamp(left, PANEL_MARGIN, maxLeft);
    const nextTop = clamp(top, PANEL_MARGIN, maxTop);
    el.style.left = nextLeft + "px";
    el.style.top = nextTop + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    hasCustomPosition = true;
  }

  /**
   * Hides the panel and clears its content.
   */
  function dismiss() {
    endDrag();
    el.hidden = true;
    clearVariantClasses();
    titleEl.textContent = "";
    titleEl.hidden = true;
    bodyEl.replaceChildren();
    setMinimized(false);
    resetPosition();
  }

  /**
   * Shows a message in the panel, replacing any current content.
   * @param {{
   *   variant?: "success" | "failure" | "info",
   *   title?: string,
   *   body?: string | Node,
   * }} options - Panel content and styling.
   */
  function show(options) {
    const opts = options || {};
    const variant = resolveVariant(opts.variant);

    clearVariantClasses();
    el.classList.add(VARIANT_CLASS[variant]);
    if (variant === "failure") {
      el.setAttribute("role", "alert");
      el.removeAttribute("aria-live");
    } else {
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
    }

    const title = opts.title != null ? String(opts.title) : "";
    titleEl.textContent = title;
    titleEl.hidden = !title;

    bodyEl.replaceChildren();
    if (opts.body instanceof Node) {
      bodyEl.appendChild(opts.body);
    } else if (opts.body != null) {
      bodyEl.textContent = String(opts.body);
    }

    setMinimized(false);
    el.style.maxHeight = "";
    el.hidden = false;
  }

  /**
   * Stops an in-progress drag and clears grab styling.
   */
  function endDrag() {
    if (!drag) {
      return;
    }
    drag = null;
    header.classList.remove("is-dragging");
  }

  /**
   * Starts dragging from the header (ignores action buttons).
   * @param {PointerEvent} evt - Pointer down event.
   */
  function onHeaderPointerDown(evt) {
    if (evt.button != null && evt.button !== 0) {
      return;
    }
    if (
      evt.target instanceof Element &&
      evt.target.closest(".lab-messages-actions")
    ) {
      return;
    }
    const mountRect = mount.getBoundingClientRect();
    const panelRect = el.getBoundingClientRect();
    if (!hasCustomPosition) {
      setPosition(panelRect.left - mountRect.left, panelRect.top - mountRect.top);
    }
    drag = {
      pointerId: evt.pointerId,
      offsetX: evt.clientX - panelRect.left,
      offsetY: evt.clientY - panelRect.top,
    };
    header.classList.add("is-dragging");
    if (typeof header.setPointerCapture === "function") {
      header.setPointerCapture(evt.pointerId);
    }
    evt.preventDefault();
  }

  /**
   * Moves the panel while a header drag is active.
   * @param {PointerEvent} evt - Pointer move event.
   */
  function onHeaderPointerMove(evt) {
    if (!drag || evt.pointerId !== drag.pointerId) {
      return;
    }
    const mountRect = mount.getBoundingClientRect();
    setPosition(
      evt.clientX - mountRect.left - drag.offsetX,
      evt.clientY - mountRect.top - drag.offsetY,
    );
  }

  /**
   * Ends a header drag when the pointer is released or cancelled.
   * @param {PointerEvent} evt - Pointer up/cancel event.
   */
  function onHeaderPointerUp(evt) {
    if (!drag || evt.pointerId !== drag.pointerId) {
      return;
    }
    if (
      typeof header.hasPointerCapture === "function" &&
      header.hasPointerCapture(evt.pointerId) &&
      typeof header.releasePointerCapture === "function"
    ) {
      header.releasePointerCapture(evt.pointerId);
    }
    endDrag();
  }

  minimizeBtn.addEventListener("click", function () {
    setMinimized(!minimized);
  });

  dismissBtn.addEventListener("click", function () {
    dismiss();
  });

  header.addEventListener("pointerdown", onHeaderPointerDown);
  header.addEventListener("pointermove", onHeaderPointerMove);
  header.addEventListener("pointerup", onHeaderPointerUp);
  header.addEventListener("pointercancel", onHeaderPointerUp);

  /**
   * Dismisses the panel when Escape is pressed and the panel is visible.
   * @param {KeyboardEvent} evt - Keydown event.
   */
  function onKeyDown(evt) {
    if (evt.key !== "Escape" || el.hidden) {
      return;
    }
    dismiss();
  }

  const keyDoc = mount.ownerDocument || document;
  keyDoc.addEventListener("keydown", onKeyDown);

  return {
    el: el,
    show: show,
    dismiss: dismiss,
  };
}
