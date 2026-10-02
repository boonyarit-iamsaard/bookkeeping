// The chrome token per scheme as sRGB hex (`globals.css` `--chrome`): the
// status bar continues the title bar, whichever scheme the system shows.
const CHROME_LIGHT = "#ffffff";
const CHROME_DARK = "#14141c";

/**
 * Keeps the one `theme-color` meta on the active scheme's chrome, now and
 * whenever the system setting changes.
 */
export function syncThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    return;
  }
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    meta?.setAttribute("content", dark.matches ? CHROME_DARK : CHROME_LIGHT);
  }
  apply();
  dark.addEventListener("change", apply);
}
