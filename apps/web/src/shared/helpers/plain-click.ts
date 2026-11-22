/**
 * A primary click with no modifier: the app may handle it in place, while a
 * modified click is left to the browser (a new tab or window).
 */
export function isPlainClick(event: Readonly<React.MouseEvent>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
