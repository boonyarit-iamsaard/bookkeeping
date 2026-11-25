import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Fails when the element's text is cut short: by its own ellipsis, by an
 * ancestor that hides or scrolls its overflow, or by running past the screen.
 * Half a pixel absorbs subpixel rounding.
 */
export async function expectUnclipped(locator: Readonly<Locator>) {
  await expect(locator).toBeVisible();
  const clipped = await locator.evaluate((element) => {
    if (element.scrollWidth > element.clientWidth + 0.5) {
      return true;
    }
    const { left, right } = element.getBoundingClientRect();
    if (left < -0.5 || right > window.innerWidth + 0.5) {
      return true;
    }
    for (
      let ancestor = element.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (getComputedStyle(ancestor).overflowX === "visible") {
        continue;
      }
      const box = ancestor.getBoundingClientRect();
      const clipLeft = box.left + ancestor.clientLeft;
      if (
        left < clipLeft - 0.5 ||
        right > clipLeft + ancestor.clientWidth + 0.5
      ) {
        return true;
      }
    }
    return false;
  });
  expect(clipped, `"${await locator.textContent()}" is clipped`).toBe(false);
}

/**
 * Every amount on screen shows whole. Hidden columns are off screen, and
 * screen-reader copies (a chart's table) are clipped by design.
 */
export async function expectNoClippedMoney(page: Readonly<Page>) {
  const amounts = await page
    .locator(".money:not(.sr-only *)")
    .filter({ visible: true })
    .all();
  expect(amounts.length).toBeGreaterThan(0);
  for (const amount of amounts) {
    await expectUnclipped(amount);
  }
}
