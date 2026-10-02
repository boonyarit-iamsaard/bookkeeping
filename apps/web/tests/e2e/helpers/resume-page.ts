import type { Page } from "@playwright/test";

/** Exercise the browser resume event that active cached reads already follow. */
export async function resumePage(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    Reflect.deleteProperty(document, "visibilityState");
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
}
