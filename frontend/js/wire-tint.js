/**
 * Parses a #rgb / #rrggbb hex string into 0–255 RGB channels.
 * @param {string} hex - CSS hex color.
 */
export function parseHexColor(hex) {
  const raw = String(hex || "").trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!match) {
    return null;
  }
  let body = match[1];
  if (body.length === 3) {
    body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

/**
 * Builds a #rrggbb string from 0–255 RGB channels.
 * @param {number} r - Red channel.
 * @param {number} g - Green channel.
 * @param {number} b - Blue channel.
 */
export function rgbToHex(r, g, b) {
  /**
   * @param {number} channel - 0–255 channel value.
   */
  function toByte(channel) {
    const clamped = Math.max(0, Math.min(255, Math.round(channel)));
    return clamped.toString(16).padStart(2, "0");
  }
  return "#" + toByte(r) + toByte(g) + toByte(b);
}

/**
 * Mixes a hex color toward white by the given amount (0–1).
 * @param {string} hex - #rgb / #rrggbb color.
 * @param {number} amount - 0 keeps the color; 1 becomes white.
 */
export function lightenHex(hex, amount) {
  const parsed = parseHexColor(hex);
  if (!parsed) {
    return hex;
  }
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    parsed.r + (255 - parsed.r) * t,
    parsed.g + (255 - parsed.g) * t,
    parsed.b + (255 - parsed.b) * t
  );
}

/**
 * Converts a hex color to an rgba() CSS string.
 * @param {string} hex - #rgb / #rrggbb color.
 * @param {number} alpha - Opacity 0–1.
 */
export function hexToRgba(hex, alpha) {
  const parsed = parseHexColor(hex);
  if (!parsed) {
    return hex;
  }
  const a = Math.max(0, Math.min(1, alpha));
  return "rgba(" + parsed.r + ", " + parsed.g + ", " + parsed.b + ", " + a + ")";
}

/**
 * Approximate relative luminance of a hex color (0–1).
 * @param {string} hex - #rgb / #rrggbb color.
 */
export function hexLuminance(hex) {
  const parsed = parseHexColor(hex);
  if (!parsed) {
    return 0;
  }
  return (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
}

/**
 * Bend / midpoint handle colors derived from a wire stroke.
 * Uses a lighter tint of the wire; near-white wires fall back to soft gray.
 * @param {string} wireHex - Wire stroke hex from WIRE_COLORS.
 */
export function bendHandleColors(wireHex) {
  const base = parseHexColor(wireHex) ? wireHex : "#0f172a";
  if (hexLuminance(base) > 0.85) {
    return {
      fill: "#f4f4f5",
      stroke: "#a1a1aa",
      haloFill: "rgba(161, 161, 170, 0.32)",
      haloStroke: "rgba(113, 113, 122, 0.85)",
    };
  }
  return {
    fill: lightenHex(base, 0.82),
    stroke: lightenHex(base, 0.28),
    haloFill: hexToRgba(lightenHex(base, 0.55), 0.32),
    haloStroke: hexToRgba(lightenHex(base, 0.2), 0.9),
  };
}
