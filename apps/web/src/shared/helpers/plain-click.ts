/** The parts of a click these helpers read. */
type Click = Pick<
  React.MouseEvent,
  "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "preventDefault"
>;

/**
 * A primary click with no modifier: the app may handle it in place, while a
 * modified click is left to the browser (a new tab or window).
 */
export function isPlainClick(event: Readonly<Click>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * A link's click handler that opens `open` in place of navigating, or leaves
 * the link alone when `open` is null (below 1024px) or the click is modified.
 */
export function openInPlace(open: (() => void) | null | undefined) {
  return (event: Click) => {
    if (open && isPlainClick(event)) {
      event.preventDefault();
      open();
    }
  };
}
