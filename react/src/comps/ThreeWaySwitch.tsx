import { Line, Rect, Text } from "react-konva";
import { Module } from "./Module";
import { pointerCursorHandlers } from "./stageCursor";
import { terminalPositions } from "./terminals";

const WIDTH = 130;
const HEIGHT = 88;

/** Toggle button chrome inside the shell. */
const BTN_X = 10;
const BTN_Y = 26;
const BTN_W = WIDTH - 20;
const BTN_H = 48;

/** Local geometry for the SPDT contact / actuator symbol (centered on the button). */
const SYMBOL_CX = WIDTH / 2;
const CONTACT_Y = BTN_Y + 20;
const SYMBOL_HALF = 22;
const HINGE_X = SYMBOL_CX;
const T1_END_X = SYMBOL_CX - SYMBOL_HALF + 4;
const T2_END_X = SYMBOL_CX + SYMBOL_HALF - 4;
const THROW_END_Y = CONTACT_Y;

const TERMINAL_LAYOUT = { top: ["T1", "COM", "T2"] } as const;
const [T1_POS, COM_POS, T2_POS] = terminalPositions("top", 3, WIDTH, HEIGHT);

type ThreeWaySwitchProps<Id extends string = string> = {
  id: Id;
  x?: number;
  y?: number;
  title?: string;
  /**
   * Throw position. False bridges COM→T1; true bridges COM→T2.
   * Matches the SPST `closed` prop naming so toggles stay consistent.
   */
  closed: boolean;
  onClosedChange: (id: Id, closed: boolean) => void;
  onDragMove?: (id: Id, x: number, y: number) => void;
  onDragEnd?: (id: Id, x: number, y: number) => void;
};

/**
 * SPDT three-way toggle with T1 (top:0), COM (top:1), and T2 (top:2).
 * Always bridges COM to exactly one traveler: open → T1, closed → T2.
 */
export function ThreeWaySwitch<Id extends string>({
  id,
  x = 0,
  y = 0,
  title = "3-Way",
  closed,
  onClosedChange,
  onDragMove,
  onDragEnd,
}: ThreeWaySwitchProps<Id>) {
  const fill = closed ? "#dbeafe" : "#f0f9ff";
  const stroke = closed ? "#2563eb" : "#7dd3fc";
  const travelerPos = closed ? T2_POS : T1_POS;
  const actuatorEndX = closed ? T2_END_X : T1_END_X;
  const clickCursor = pointerCursorHandlers();

  /**
   * Toggles T1/T2 throw and stops the event from reaching the stage.
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
      {/* Visible bridge from COM to the selected traveler */}
      <Line
        points={[COM_POS.x, COM_POS.y, travelerPos.x, travelerPos.y]}
        stroke="#2563eb"
        strokeWidth={3}
        lineCap="round"
        listening={false}
      />

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

      {/* Traveler contact pads (T1 left, T2 right) */}
      <Line
        points={[T1_END_X - 4, THROW_END_Y, T1_END_X + 4, THROW_END_Y]}
        stroke="#18181b"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      <Line
        points={[T2_END_X - 4, THROW_END_Y, T2_END_X + 4, THROW_END_Y]}
        stroke="#18181b"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      {/* Common hinge lead */}
      <Line
        points={[HINGE_X, CONTACT_Y - 10, HINGE_X, CONTACT_Y]}
        stroke="#18181b"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      {/* Actuator arm — swings between T1 and T2 */}
      <Line
        points={[HINGE_X, CONTACT_Y, actuatorEndX, THROW_END_Y]}
        stroke="#2563eb"
        strokeWidth={2}
        lineCap="round"
        listening={false}
      />
      <Text
        x={BTN_X}
        y={BTN_Y + BTN_H - 16}
        width={BTN_W}
        align="center"
        text={closed ? "T2" : "T1"}
        fontSize={10}
        fontFamily="system-ui, Arial, sans-serif"
        fontStyle="bold"
        fill={closed ? "#1d4ed8" : "#2563eb"}
        listening={false}
      />
    </Module>
  );
}

export const THREE_WAY_SIZE = { width: WIDTH, height: HEIGHT } as const;

/** Terminal indices on the three-way’s top edge. */
export const THREE_WAY_TERMINALS = {
  t1: 0,
  com: 1,
  t2: 2,
} as const;
