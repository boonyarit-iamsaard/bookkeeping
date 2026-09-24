import type { Page } from "@playwright/test";

/**
 * Moves the test pointer off whatever the last click left under it.
 *
 * A click leaves the synthetic pointer where it was, so a link that renders
 * there afterwards, such as the tab bar's ＋ under a full-width bottom action,
 * starts an intent preload. When the next `page.goto` or `page.reload` unloads
 * the document mid-preload, WebKit reports the cancelled fetch or chunk import
 * as a page error. Call this right after a click that navigates or closes a
 * surface, before the new screen can render under the pointer.
 */
export async function parkPointer(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}
