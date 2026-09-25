import type { Locator, Page } from "@playwright/test";

/** The floating surface the app's pickers open: the last popover slot. */
export function popup(page: Readonly<Page>): Locator {
  return page.locator("[data-slot=popover-content]").last();
}
