import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { isDesktop } from "./viewport";

/** Signs out from Home through the account control this viewport shows. */
export async function signOut(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  if (isDesktop(page)) {
    await page.getByRole("menuitem", { name: "Sign out" }).click();
  } else {
    await page
      .getByRole("dialog", { name: "Account" })
      .getByRole("button", { name: "Sign out" })
      .click();
  }
  await expect(page).toHaveURL(/\/sign-in$/);
}
