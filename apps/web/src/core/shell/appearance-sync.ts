import type { Appearance, Scheme } from "@/core/shell/appearance";
import { parseAppearance, resolveScheme } from "@/core/shell/appearance";

/**
 * Shared with the inline pre-paint scripts in `index.html` and
 * `public/offline.html`, which copy this key and `CHROME_COLOR`.
 */
export const APPEARANCE_STORAGE_KEY = "bookkeeping.appearance";

// The chrome token per scheme as sRGB hex (`globals.css` `--chrome`): the
// status bar continues the title bar, whichever scheme is shown.
const CHROME_COLOR = {
  light: "#ffffff",
  dark: "#14141c",
} as const satisfies Record<Scheme, string>;

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

// The in-memory copy of the choice, read only when storage throws because the
// browser blocks site data; the choice then lasts as long as the page.
let fallbackAppearance: Appearance = "system";

export function getAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return fallbackAppearance;
  }
}

function showScheme(): void {
  const scheme = resolveScheme({
    appearance: getAppearance(),
    systemDark: window.matchMedia(SYSTEM_DARK_QUERY).matches,
  });
  document.documentElement.dataset.scheme = scheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME_COLOR[scheme]);
}

/** Switches in one frame, so no color transition smears across the page. */
function showSchemeInstantly(): void {
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(pause);
  showScheme();
  // Reading a computed style commits the new colors before transitions return.
  document.documentElement.getBoundingClientRect();
  requestAnimationFrame(() => pause.remove());
}

function showAndNotify(): void {
  showSchemeInstantly();
  for (const listener of listeners) {
    listener();
  }
}

export function setAppearance(appearance: Appearance): void {
  fallbackAppearance = appearance;
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  } catch {
    // Kept in memory instead; see `fallbackAppearance`.
  }
  showAndNotify();
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Keeps the shown scheme and `theme-color` on the Appearance choice, following
 * the system setting under System and a choice made in another tab.
 */
export function syncAppearance(): void {
  showScheme();
  window
    .matchMedia(SYSTEM_DARK_QUERY)
    .addEventListener("change", showSchemeInstantly);
  window.addEventListener("storage", (event) => {
    if (event.key === APPEARANCE_STORAGE_KEY) {
      showAndNotify();
    }
  });
}
