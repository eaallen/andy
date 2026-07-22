import { Line, Rect, Text } from "react-konva";
import { Module } from "./Module";
import { pointerCursorHandlers } from "./stageCursor";
import { terminalPositions } from "./terminals";

const WIDTH = 110;
const HEIGHT = 88;

/** Toggle button chrome inside the shell. */
const BTN_X = 10;
const BTN_Y = 26;
const BTN_W = WIDTH - 20;
const BTN_H = 48;

/** Local geometry for the SPST contact / actuator symbol (centered on the button). */
const SYMBOL_CX = WIDTH / 2;
const SYMBOL_CY = BTN_Y + 14;
const SYMBOL_HALF = 18;
const CONTACT_Y = SYMBOL_CY + 6;
const HINGE_X = SYMBOL_CX - SYMBOL_HALF + 10;
const OPEN_END_X = SYMBOL_CX + SYMBOL_HALF - 4;
const OPEN_END_Y = CONTACT_Y - 10;
const CLOSED_END_X = SYMBOL_CX + SYMBOL_HALF - 10;
const CLOSED_END_Y = CONTACT_Y;

const TERMINAL_LAYOUT = { top: ["COM", "NO"] } as const;
const [COM_POS, NO_POS] = terminalPositions("top", 2, WIDTH, HEIGHT);

type SwitchProps<Id extends string = string> = {
  id: Id;
  x?: number;
  y?: number;
  title?: string;
  /** True when COM bridges to NO. */
  closed: boolean;
  onClosedChange: (id: Id, closed: boolean) => void;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
};

/**
 * SPST toggle switch with COM (top:0) and NO (top:1).
 * Click the button to open/close; when closed, COM bridges to NO.
 */
export function Switch<Id extends string>({
  id,
  x = 0,
  y = 0,
  title = "Switch",
  closed,
  onClosedChange,
  onDragMove,
  onDragEnd,
}: SwitchProps<Id>) {
  const fill = closed ? "#dbeafe" : "#f0f9ff";
  const stroke = closed ? "#2563eb" : "#7dd3fc";
  const actuatorEndX = closed ? CLOSED_END_X : OPEN_END_X;
  const actuatorEndY = closed ? CLOSED_END_Y : OPEN_END_Y;
  const clickCursor = pointerCursorHandlers();

  /**
   * Toggles open/closed and stops the event from reaching the stage.
   */
  function toggle(e: { cancelBubble: boolean }) {
    e.cancelBubble = true;
    onClosedChange(id, !closed);
  }

  return (
    <Module
      id={id}
      x={x}
      y={y}
      width={WIDTH}
      height={HEIGHT}
      title={title}
      fill={fill}
      stroke={stroke}
      bodyPointer={false}
      terminals={TERMINAL_LAYOUT}
      onDragMove={
        onDragMove
          ? (moduleId, mx, my) => onDragMove(moduleId as Id, mx, my)
          : undefined
      }
      onDragEnd={
        onDragEnd
          ? (moduleId, mx, my) => onDragEnd(moduleId as Id, mx, my)
          : undefined
      }
    >
      {/* Visible bridge between COM and NO while closed */}
      {closed ? (
        <Line
          points={[COM_POS.x, COM_POS.y, NO_POS.x, NO_POS.y]}
          stroke="#2563eb"
          strokeWidth={3}
          lineCap="round"
          listening={false}
        />
      ) : null}

      {/* Raised toggle button — clear click target */}
      <Rect
        x={BTN_X}
        y={BTN_Y}
        width={BTN_W}
        height={BTN_H}
        fill={closed ? "#bfdbfe" : "#ffffff"}
        stroke={closed ? "#2563eb" : "#93c5fd"}
        strokeWidth={2}
        cornerRadius={8}
        {...clickCursor}
        onMouseDown={(e) => {
          e.cancelBubble = true;
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
        }}
        onClick={toggle}
        onTap={toggle}
      />

      {/* Left contact lead */}
      <Line
        points={[SYMBOL_CX - SYMBOL_HALF, CONTACT_Y, HINGE_X, CONTACT_Y]}
        stroke="#18181b"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      {/* Right contact lead */}
      <Line
        points={[CLOSED_END_X, CONTACT_Y, SYMBOL_CX + SYMBOL_HALF, CONTACT_Y]}
        stroke="#18181b"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      {/* Actuator arm */}
      <Line
        points={[HINGE_X, CONTACT_Y, actuatorEndX, actuatorEndY]}
        stroke={closed ? "#2563eb" : "#18181b"}
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      <Text
        x={BTN_X}
        y={BTN_Y + BTN_H - 16}
        width={BTN_W}
        align="center"
        text={closed ? "Closed" : "Open"}
        fontSize={10}
        fontFamily="system-ui, Arial, sans-serif"
        fontStyle="bold"
        fill={closed ? "#1d4ed8" : "#2563eb"}
        listening={false}
      />
    </Module>
  );
}

export const SWITCH_SIZE = { width: WIDTH, height: HEIGHT } as const;

/** Terminal indices on the switch’s top edge. */
export const SWITCH_TERMINALS = {
  com: 0,
  no: 1,
} as const;
