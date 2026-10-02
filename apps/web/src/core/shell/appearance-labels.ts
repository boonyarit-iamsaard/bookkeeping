import type { Appearance } from "@/core/shell/appearance";
import { APPEARANCES } from "@/core/shell/appearance";

export const APPEARANCE_LABELS = {
  system: "System",
  light: "Light",
  dark: "Dark",
} as const satisfies Record<Appearance, string>;

export const APPEARANCE_OPTIONS = APPEARANCES.map((value) => ({
  value,
  label: APPEARANCE_LABELS[value],
}));
