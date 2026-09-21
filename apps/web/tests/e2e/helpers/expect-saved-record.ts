import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Waits for a saved entry to be listed in the history after a form submit.
 *
 * The URL changes as soon as the router commits the navigation, while the
 * history page's chunk may still be importing. Navigating away at that point
 * aborts the import, which WebKit reports as a module load failure, and the
 * router answers that with a page reload that cancels the navigation. Waiting
 * for the record itself closes that window.
 */
export async function expectSavedRecord(page: Page): Promise<Locator> {
  await expect(page).toHaveURL(/\/transactions\?created=/);
  const saved = page.locator("[data-saved]");
  await expect(saved).toBeVisible();
  return saved;
}
