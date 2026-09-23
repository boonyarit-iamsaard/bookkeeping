import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Waits for a saved entry to be listed on the screen capture returned to.
 *
 * The URL changes as soon as the router commits the navigation, while the
 * returned page's chunk may still be importing. Navigating away at that point
 * aborts the import, which WebKit reports as a module load failure, and the
 * router answers that with a page reload that cancels the navigation. Waiting
 * for the record itself closes that window. Moving the test pointer away before
 * the new row can render also keeps it from accidentally starting an intent
 * preload that WebKit rejects when the next `page.goto` unloads the document.
 */
export async function expectSavedRecord(page: Page): Promise<Locator> {
  await page.mouse.move(0, 0);
  await expect(page).toHaveURL(/[?&]created=/);
  const saved = page.locator("[data-saved]");
  await expect(saved).toBeVisible();
  return saved;
}
