import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { parkPointer } from "./park-pointer";

/**
 * Waits for a saved entry to be listed on the screen capture returned to.
 *
 * The URL changes as soon as the router commits the navigation, while the
 * returned page's chunk may still be importing. Navigating away at that point
 * aborts the import, which WebKit reports as a module load failure, and the
 * router answers that with a page reload that cancels the navigation. Waiting
 * for the record itself closes that window. The pointer is parked first so the
 * new row cannot render under it and start an intent preload.
 */
export async function expectSavedRecord(page: Page): Promise<Locator> {
  await parkPointer(page);
  await expect(page).toHaveURL(/[?&]created=/);
  const saved = page.locator("[data-saved]");
  await expect(saved).toBeVisible();
  return saved;
}
