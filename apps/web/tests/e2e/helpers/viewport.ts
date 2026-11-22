import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// The tab bar serves phones and tablets; from 1024px the desktop shell's
// sidebar carries the destinations. Sheets turn into dialogs earlier, at
// 640px, which no project width falls between.
const DESKTOP_MIN_WIDTH = 1024;

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

/** The page never gains horizontal overflow at the supported width. */
export async function expectNoHorizontalOverflow(
  page: Readonly<Page>,
): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
