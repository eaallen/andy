import { WIRE_COLOR_OPTIONS, WIRE_COLORS } from "./components/constants.js";

const WIRE_MENU_GAP = 10;
const WIRE_MENU_MARGIN = 8;

const TRASH_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M3.5 4.5h9M6.5 4.5V3.25A.75.75 0 0 1 7.25 2.5h1.5a.75.75 0 0 1 .75.75V4.5m-5 0 .6 8.1a1 1 0 0 0 1 .9h3.3a1 1 0 0 0 1-.9l.6-8.1M6.5 7v4.5M9.5 7v4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

const COLOR_MORE_ICON =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
  '<path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

const CLOSE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  "</svg>";

/**
 * Creates a floating delete + color menu for a selected wire.
 * @param {HTMLElement} mount - Parent that positions relatively (stage wrap).
 * @param {{
 *   onDelete: () => void,
 *   onPickColor: (colorKey: string) => void,
 *   onDismiss: () => void,
 *   colorOptions?: Array<{ id: string, label: string, hex: string }>,
 * }} handlers - Menu action handlers.
 */
export function createWireMenu(mount, handlers) {
  const el = document.createElement("div");
  el.className = "wire-menu";
  el.setAttribute("role", "menu");
  el.setAttribute("aria-label", "Wire actions");
  el.hidden = true;

  const colorOptions =
    handlers.colorOptions && handlers.colorOptions.length
      ? handlers.colorOptions
      : WIRE_COLOR_OPTIONS;

  let colorPickerOpen = false;
  let currentColor = colorOptions[0] ? colorOptions[0].id : "black";
  let canDelete = true;
  let worldAnchor = /** @type {{ x: number; y: number }|null} */ (null);
  let lastScreen = /** @type {{ x: number; y: number }|null} */ (null);
  let lastViewport = /** @type {{ width: number; height: number }|null} */ (null);
  let suppressOutside = false;

  /**
   * Resolves a swatch entry for the current color key.
   * @param {string} colorKey - Color id.
   */
  function resolveColorEntry(colorKey) {
    const fromPalette = colorOptions.find(function (entry) {
      return entry.id === colorKey;
    });
    if (fromPalette) {
      return fromPalette;
    }
    const fromDefaults = WIRE_COLOR_OPTIONS.find(function (entry) {
      return entry.id === colorKey;
    });
    if (fromDefaults) {
      return fromDefaults;
    }
    const hex = WIRE_COLORS[colorKey];
    if (hex) {
      return {
        id: colorKey,
        label: colorKey.charAt(0).toUpperCase() + colorKey.slice(1),
        hex: hex,
      };
    }
    return colorOptions[0] || WIRE_COLOR_OPTIONS[0];
  }

  /**
   * Builds the menu DOM for the current color / delete state.
   */
  function render() {
    const current = resolveColorEntry(currentColor);

    let html =
      '<div class="wire-menu-row">' +
      (canDelete
        ? '<button type="button" class="wire-menu-item wire-menu-item--danger" data-wire-menu="delete" role="menuitem" aria-label="Delete wire" title="Delete wire">' +
          TRASH_ICON +
          "</button>"
        : "") +
      '<button type="button" class="wire-menu-color-trigger" data-wire-menu="toggle-color" role="menuitem" aria-haspopup="true" aria-expanded="' +
      (colorPickerOpen ? "true" : "false") +
      '" aria-label="Wire color: ' +
      current.label +
      '. Choose color" title="Choose color">' +
      '<span class="wire-menu-swatch" style="background-color:' +
      current.hex +
      '"></span>' +
      COLOR_MORE_ICON +
      "</button>" +
      '<button type="button" class="wire-menu-item" data-wire-menu="close" role="menuitem" aria-label="Close" title="Close">' +
      CLOSE_ICON +
      "</button>" +
      "</div>";

    if (colorPickerOpen) {
      html +=
        '<div class="wire-menu-colors" role="group" aria-label="Wire color options">';
      for (let i = 0; i < colorOptions.length; i += 1) {
        const entry = colorOptions[i];
        const selected = entry.id === currentColor;
        html +=
          '<button type="button" class="wire-menu-swatch' +
          (selected ? " wire-menu-swatch--selected" : "") +
          '" data-wire-menu-color="' +
          entry.id +
          '" role="menuitemradio" aria-checked="' +
          (selected ? "true" : "false") +
          '" aria-label="' +
          entry.label +
          '" title="' +
          entry.label +
          '" style="background-color:' +
          entry.hex +
          '"></button>';
      }
      html += "</div>";
    }

    el.innerHTML = html;
  }

  /**
   * Positions the menu near a screen-space anchor inside the mount.
   * @param {{ x: number; y: number }} screen - Anchor in mount-local pixels.
   * @param {{ width: number; height: number }} viewport - Mount size.
   */
  function positionAt(screen, viewport) {
    lastScreen = { x: screen.x, y: screen.y };
    lastViewport = { width: viewport.width, height: viewport.height };
    el.hidden = false;
    // Force layout so offsetWidth/Height are valid.
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width <= 0 || height <= 0) {
      el.style.left = screen.x + "px";
      el.style.top = screen.y + "px";
      return;
    }

    let top = screen.y - height - WIRE_MENU_GAP;
    if (top < WIRE_MENU_MARGIN) {
      top = screen.y + WIRE_MENU_GAP;
    }
    if (top + height > viewport.height - WIRE_MENU_MARGIN) {
      top = Math.max(
        WIRE_MENU_MARGIN,
        viewport.height - WIRE_MENU_MARGIN - height
      );
    }

    let left = screen.x - width / 2;
    left = Math.min(
      Math.max(left, WIRE_MENU_MARGIN),
      Math.max(WIRE_MENU_MARGIN, viewport.width - WIRE_MENU_MARGIN - width)
    );

    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  /**
   * Opens the menu for a wire at a world-space anchor.
   * @param {{
   *   colorKey: string,
   *   canDelete: boolean,
   *   world: { x: number; y: number },
   *   screen: { x: number; y: number },
   *   viewport: { width: number; height: number },
   * }} state - Menu open state.
   */
  function open(state) {
    currentColor = state.colorKey;
    canDelete = state.canDelete !== false;
    worldAnchor = { x: state.world.x, y: state.world.y };
    colorPickerOpen = false;
    render();
    positionAt(state.screen, state.viewport);
  }

  /**
   * Updates screen position from the current world anchor (after pan/zoom).
   * @param {(world: {x:number,y:number}) => {x:number,y:number}} worldToScreen - Projector.
   * @param {{ width: number; height: number }} viewport - Mount size.
   */
  function syncPosition(worldToScreen, viewport) {
    if (el.hidden || !worldAnchor) {
      return;
    }
    positionAt(worldToScreen(worldAnchor), viewport);
  }

  /**
   * Updates the displayed color without closing.
   * @param {string} colorKey - New color key.
   * @param {(world: {x:number,y:number}) => {x:number,y:number}} [worldToScreen] - Optional projector.
   * @param {{ width: number; height: number }} [viewport] - Optional viewport.
   */
  function setColor(colorKey, worldToScreen, viewport) {
    currentColor = colorKey;
    render();
    if (!el.hidden && worldAnchor && worldToScreen && viewport) {
      positionAt(worldToScreen(worldAnchor), viewport);
    }
  }

  /**
   * Hides the menu.
   */
  function close() {
    if (el.hidden) {
      return;
    }
    el.hidden = true;
    colorPickerOpen = false;
    worldAnchor = null;
    suppressOutside = true;
    window.setTimeout(function () {
      suppressOutside = false;
    }, 0);
  }

  /**
   * Returns whether the menu is visible.
   */
  function isOpen() {
    return !el.hidden;
  }

  /**
   * Returns whether the next wire select should be suppressed (same gesture as dismiss).
   */
  function shouldSuppressOpen() {
    return suppressOutside || !el.hidden;
  }

  el.addEventListener("click", function (evt) {
    const target = evt.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-wire-menu], [data-wire-menu-color]");
    if (!(button instanceof HTMLElement)) {
      return;
    }
    evt.stopPropagation();

    const action = button.getAttribute("data-wire-menu");
    if (action === "delete") {
      handlers.onDelete();
      return;
    }
    if (action === "close") {
      handlers.onDismiss();
      return;
    }
    if (action === "toggle-color") {
      colorPickerOpen = !colorPickerOpen;
      render();
      if (lastScreen && lastViewport) {
        positionAt(lastScreen, lastViewport);
      }
      return;
    }
    const color = button.getAttribute("data-wire-menu-color");
    if (color) {
      colorPickerOpen = false;
      currentColor = color;
      render();
      if (lastScreen && lastViewport) {
        positionAt(lastScreen, lastViewport);
      }
      handlers.onPickColor(color);
    }
  });

  /**
   * Returns whether a pointer event originated inside the wire menu.
   * Prefer composedPath: document listeners see retargeted shadow hosts.
   * @param {PointerEvent} evt - Pointer event.
   */
  function isEventInsideMenu(evt) {
    const path =
      typeof evt.composedPath === "function" ? evt.composedPath() : [];
    for (let i = 0; i < path.length; i += 1) {
      if (path[i] === el) {
        return true;
      }
    }
    const target = evt.target;
    return target instanceof Node && el.contains(target);
  }

  /**
   * Dismisses on outside pointer press (canvas, toolbar, page chrome, …).
   * @param {PointerEvent} evt - Pointerdown event.
   */
  function onPointerDown(evt) {
    if (el.hidden) {
      return;
    }
    if (isEventInsideMenu(evt)) {
      return;
    }
    handlers.onDismiss();
  }

  // Shadow root: targets are not retargeted, so contains() works for in-lab clicks.
  const root = mount.getRootNode();
  if (root && root !== document && typeof root.addEventListener === "function") {
    root.addEventListener("pointerdown", onPointerDown, true);
  }
  // Document: catch presses outside the shadow host (lab picker, etc.).
  document.addEventListener("pointerdown", onPointerDown, true);

  mount.appendChild(el);
  render();

  return {
    open: open,
    close: close,
    isOpen: isOpen,
    shouldSuppressOpen: shouldSuppressOpen,
    syncPosition: syncPosition,
    setColor: setColor,
    getWorldAnchor: function () {
      return worldAnchor;
    },
    /**
     * Removes listeners and DOM.
     */
    destroy: function () {
      if (root && root !== document && typeof root.removeEventListener === "function") {
        root.removeEventListener("pointerdown", onPointerDown, true);
      }
      document.removeEventListener("pointerdown", onPointerDown, true);
      el.remove();
    },
  };
}
