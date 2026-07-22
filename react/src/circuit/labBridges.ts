import { terminalKey } from "../comps/terminals";
import type { ComponentBridges, WireEdge } from "./graph";

/**
 * Internal bridge between top terminals 0 and 1 (doorbell COM↔SIG, SPST COM↔NO).
 * @param {string} id - Component id.
 */
const TOP_01_BRIDGE = (id: string): WireEdge[] => [
  {
    from: terminalKey(id, "top", 0),
    to: terminalKey(id, "top", 1),
  },
];

/**
 * Default closed-switch bridges for the experimental lab modules.
 */
export const LAB_BRIDGES: ComponentBridges = {
  front: TOP_01_BRIDGE("front"),
  rear: TOP_01_BRIDGE("rear"),
  switch: TOP_01_BRIDGE("switch"),
};
