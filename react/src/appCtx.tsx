import { createContext, useContext, type ReactNode } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

export type TerminalPointerDown = (
  terminalId: string,
  e: KonvaEventObject<MouseEvent | TouchEvent>,
) => void;

export type AppCtxValue = {
  /** True while a wire is being drawn (pending click or drag). */
  wireMode: boolean;
  /** Terminal selected as the first endpoint of a new wire. */
  pendingTerminalId: string | null;
  onTerminalPointerDown: TerminalPointerDown;
};

const defaultAppCtx: AppCtxValue = {
  wireMode: false,
  pendingTerminalId: null,
  onTerminalPointerDown: () => {},
};

export const AppCtx = createContext<AppCtxValue>(defaultAppCtx);

type AppCtxProviderProps = {
  value: AppCtxValue;
  children: ReactNode;
};

/**
 * Provides shared app-level lab state to canvas components.
 */
export function AppCtxProvider({ value, children }: AppCtxProviderProps) {
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/**
 * Reads shared app-level lab state (wire mode, pending terminal, etc.).
 */
export function useAppCtx() {
  return useContext(AppCtx);
}
