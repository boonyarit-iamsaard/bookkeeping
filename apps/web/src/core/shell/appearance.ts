/** System first: it is the default and the one most people keep. */
export const APPEARANCES = ["system", "light", "dark"] as const;

const APPEARANCE_SET: ReadonlySet<string> = new Set(APPEARANCES);

/** The device's Appearance choice; System follows the OS setting. */
export type Appearance = (typeof APPEARANCES)[number];

function isAppearance(value: string): value is Appearance {
  return APPEARANCE_SET.has(value);
}

// The inline pre-paint scripts in `index.html` and `public/offline.html` copy
// `parseAppearance` and `resolveScheme`, since they run before any module
// loads; change them together.

/** Reads a stored choice; anything missing or unknown is System. */
export function parseAppearance(stored: string | null): Appearance {
  return stored !== null && isAppearance(stored) ? stored : "system";
}

export type Scheme = "light" | "dark";

export interface ResolveSchemeInput {
  appearance: Appearance;
  systemDark: boolean;
}

/** The scheme on screen: the chosen one, or the system's under System. */
export function resolveScheme({
  appearance,
  systemDark,
}: Readonly<ResolveSchemeInput>): Scheme {
  if (appearance === "system") {
    return systemDark ? "dark" : "light";
  }
  return appearance;
}
