/**
 * Turns a width/height HTML attribute into a CSS size value.
 * Bare numbers become pixels; other values (%, vh, px, …) pass through.
 * @param {string | null | undefined} value - Attribute value from the HTML tag.
 */
export function normalizeCssSize(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed + "px";
  }
  return trimmed;
}

/**
 * Applies width/height HTML attributes onto a circuit-lab host's inline style.
 * Missing or empty attributes clear the inline size so CSS defaults apply.
 * @param {HTMLElement} el - The circuit-lab host element.
 */
export function applyCircuitLabSizeAttributes(el) {
  const width = normalizeCssSize(el.getAttribute("width"));
  const height = normalizeCssSize(el.getAttribute("height"));
  if (width) {
    el.style.width = width;
  } else {
    el.style.removeProperty("width");
  }
  if (height) {
    el.style.height = height;
  } else {
    el.style.removeProperty("height");
  }
}
