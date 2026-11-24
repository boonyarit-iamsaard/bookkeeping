import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// A tablet: wider than the column, so a second width would show, yet below
// the 1024px desktop shell.
test.use({ viewport: { width: 900, height: 1000 } });

test("every screen below 1024px keeps one column width", async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  const wallet = page.url();

  const widths: number[] = [];
  for (const path of [
    "/",
    "/transactions",
    "/transactions/new",
    "/wallets/new",
    new URL(wallet).pathname,
    `${new URL(wallet).pathname}/manage`,
    "/categories",
    "/tags",
    "/reports",
  ]) {
    await page.goto(path);
    const main = page.locator("main:not([aria-busy])");
    await expect(main).toBeVisible();
    widths.push((await main.boundingBox())?.width ?? 0);
  }
  expect(new Set(widths).size, `widths: ${widths.join(", ")}`).toBe(1);

  // An entry form narrows its fields, not the page.
  await page.goto("/transactions/new");
  const amount = page.getByLabel("Amount");
  const main = await page.locator("main").boundingBox();
  const field = await amount.boundingBox();
  expect(field?.width ?? 0).toBeLessThanOrEqual(448);
  expect(field?.width ?? 0).toBeLessThan(main?.width ?? 0);
});
