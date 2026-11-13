import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * A tappable area is the rendered control itself, never a padded parent: the
 * box must span at least 44 CSS pixels in both dimensions, width included.
 */
export async function expectTouchTarget(
  control: Readonly<Locator>,
  minimum = 44,
) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(minimum - GEOMETRY_EPSILON);
  expect(box?.height).toBeGreaterThanOrEqual(minimum - GEOMETRY_EPSILON);
}

const TOUCH_TARGET_SELECTOR = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "textarea",
  "select",
  '[role="combobox"]',
  '[role="option"]',
  '[role="radio"]',
  '[data-slot="select-scroll-up-button"]',
  '[data-slot="select-scroll-down-button"]',
].join(", ");
const GEOMETRY_EPSILON = 0.01;

/** Visible controls inside one surface must have independent hit boxes. */
export async function expectNoOverlappingTouchTargets(
  surface: Readonly<Locator>,
) {
  const boxes = await surface
    .locator(TOUCH_TARGET_SELECTOR)
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          element.closest('[aria-hidden="true"]') !== null ||
          style.display === "none" ||
          style.visibility !== "visible" ||
          style.pointerEvents === "none" ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return [];
        }
        let left = rect.left;
        let top = rect.top;
        let right = rect.right;
        let bottom = rect.bottom;
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const ancestorStyle = window.getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          if (ancestorStyle.overflowX !== "visible") {
            const clipLeft = ancestorRect.left + ancestor.clientLeft;
            left = Math.max(left, clipLeft);
            right = Math.min(right, clipLeft + ancestor.clientWidth);
          }
          if (ancestorStyle.overflowY !== "visible") {
            const clipTop = ancestorRect.top + ancestor.clientTop;
            top = Math.max(top, clipTop);
            bottom = Math.min(bottom, clipTop + ancestor.clientHeight);
          }
        }
        left = Math.max(left, 0);
        top = Math.max(top, 0);
        right = Math.min(right, window.innerWidth);
        bottom = Math.min(bottom, window.innerHeight);
        if (right <= left || bottom <= top) {
          return [];
        }
        return [
          {
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              element.tagName,
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
          },
        ];
      }),
    );

  for (let first = 0; first < boxes.length; first += 1) {
    const firstBox = boxes[first];
    for (let second = first + 1; second < boxes.length; second += 1) {
      const secondBox = boxes[second];
      const overlapWidth =
        Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
        Math.max(firstBox.x, secondBox.x);
      const overlapHeight =
        Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
        Math.max(firstBox.y, secondBox.y);
      expect(
        overlapWidth > 0 && overlapHeight > 0,
        `Visible touch targets "${firstBox.label}" and "${secondBox.label}" overlap`,
      ).toBe(false);
    }
  }
}
