import { describe, expect, test, vi } from "vitest";
import { openInPlace } from "./plain-click";

function click(init: { button?: number; metaKey?: boolean } = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...init,
  };
}

describe("openInPlace", () => {
  test("opens in place of navigating on a plain click", () => {
    const open = vi.fn();
    const event = click();
    openInPlace(open)(event);
    expect(open).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  test("leaves a modified or secondary click to the browser", () => {
    const open = vi.fn();
    for (const event of [click({ metaKey: true }), click({ button: 1 })]) {
      openInPlace(open)(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(open).not.toHaveBeenCalled();
  });

  test("leaves the link alone when nothing opens in place", () => {
    const event = click();
    openInPlace(null)(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
