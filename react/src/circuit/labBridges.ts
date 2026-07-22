import { terminalKey } from "../comps/terminals";
import type { ComponentBridges, WireEdge } from "./graph";

/**
 * Internal bridges when a doorbell button is pressed (COM ↔ signal path).
 * Doorbells use three top terminals; indices 0 and 1 close when pressed.
 */
const DOORBELL_TOP_BRIDGE = (id: string): WireEdge[] => [
  {
    from: terminalKey(id, "top", 0),
    to: terminalKey(id, "top", 1),
  },
];

/**
 * Default closed-switch bridges for the experimental lab modules.
 */
export const LAB_BRIDGES: ComponentBridges = {
  front: DOORBELL_TOP_BRIDGE("front"),
  rear: DOORBELL_TOP_BRIDGE("rear"),
};
