import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

interface WalletSeed {
  name: string;
  openingAmount: string;
  openingDate: string;
}

/** Creates a wallet through the real form and waits for it to be listed. */
export async function createWalletThroughForm(
  page: Page,
  { name, openingAmount, openingDate }: Readonly<WalletSeed>,
): Promise<void> {
  await page.goto("/wallets/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Opening balance").fill(openingAmount);
  await page.getByLabel("Opening date").fill(openingDate);
  await page.getByRole("button", { name: "Create wallet" }).click();
  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();
}
