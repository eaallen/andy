import type { KonvaEventObject } from "konva/lib/Node";

/** Default canvas cursor when not over a clickable shape. */
export const STAGE_DEFAULT_CURSOR = "grab";

/**
 * Sets the Konva stage container cursor.
 */
export function setStageCursor(
  e: KonvaEventObject<MouseEvent>,
  cursor: string,
) {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
}

/**
 * Mouse enter/leave handlers that show a pointer over clickable shapes.
 */
export function pointerCursorHandlers(cursor = "pointer") {
  return {
    onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
      setStageCursor(e, cursor);
    },
    onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
      setStageCursor(e, STAGE_DEFAULT_CURSOR);
    },
  };
}
