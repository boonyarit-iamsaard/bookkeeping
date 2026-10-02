import { useSyncExternalStore } from "react";
import type { Appearance } from "@/core/shell/appearance";
import {
  getAppearance,
  setAppearance,
  subscribeAppearance,
} from "@/core/shell/appearance-sync";

export interface AppearanceState {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

/** The device's Appearance choice, re-rendering when it changes. */
export function useAppearance(): AppearanceState {
  const appearance = useSyncExternalStore(subscribeAppearance, getAppearance);
  return { appearance, setAppearance };
}
