import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("Wallets lists every wallet in a table, archived ones captioned", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its card list");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Old card",
    openingAmount: "50",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Old card", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();

  await page.goto("/wallets");
  await expect(
    page.getByRole("heading", { name: "Wallets", level: 1 }),
  ).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText([
    "Wallet",
    "Type",
    "Held as",
    "Balance",
  ]);
  const cash = table.getByRole("row", { name: /^Cash/ });
  await expect(cash).toContainText("Spendable");
  await expect(cash).toContainText("฿1,000.00");
  await expect(cash).not.toContainText("Archived");
  const oldCard = table.getByRole("row", { name: /Old card/ });
  await expect(oldCard).toContainText("Archived");
  await expect(oldCard).toContainText("฿50.00");
  await expect(table.getByRole("row", { name: /Total balance/ })).toContainText(
    "฿1,050.00",
  );
  // The total is the table's footer; no hero repeats it.
  await expect(page.getByRole("region", { name: "Total balance" })).toHaveCount(
    0,
  );

  // The link is stretched over the row, so a click beside the name opens it too.
  await oldCard.click({ position: { x: 500, y: 10 } });
  await expect(page).toHaveURL(/\/wallets\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Old card", level: 1 }),
  ).toBeVisible();

  await page.goto("/wallets");
  await page.getByRole("link", { name: "New wallet" }).click();
  await expect(page.getByRole("dialog", { name: "New wallet" })).toBeVisible();
  await expect(page).toHaveURL(/\/wallets$/);
});

test("Wallets loads without sample money, then offers only wallet creation when empty", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its card list");
  await signUpFreshUser(page);
  await page.route(/\/v1\/wallets(\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });

  await page.goto("/wallets");
  await expect(page.getByText("Loading your records…")).toBeAttached();
  await expect(page.getByText(/฿/)).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "No wallets yet" }),
  ).toBeVisible();
  await expect(page.getByText(/฿/)).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("link", { name: "Create your first wallet" }).click();
  await expect(page.getByRole("dialog", { name: "New wallet" })).toBeVisible();
  await expect(page).toHaveURL(/\/wallets$/);
});
