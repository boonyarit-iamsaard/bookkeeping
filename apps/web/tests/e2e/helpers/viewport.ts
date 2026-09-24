import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// The tab bar serves phones; from 640px the header carries the destinations.
const DESKTOP_MIN_WIDTH = 640;

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

/** The page never gains horizontal overflow at the supported width. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
