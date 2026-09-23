import { expect, test } from "@playwright/test";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a wallet's page shows its balance and only its transactions", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Savings",
    openingAmount: "5000",
    openingDate: "2026-09-01",
  });
  for (const [wallet, amount] of [
    ["Cash", "80"],
    ["Savings", "250"],
  ] as const) {
    await page.goto("/transactions/new");
    await page.getByLabel("Amount").fill(amount);
    await chooseOption(page.getByLabel("Wallet", { exact: true }), wallet);
    await page
      .getByRole("button", { name: new RegExp(`· ${wallet}$`) })
      .click();
    await expectSavedRecord(page);
  }

  await page.goto("/wallets");
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cash", level: 1 }),
  ).toBeVisible();
  await expect(
    page.locator(
      '[aria-labelledby="wallet-balance-heading"] .money [aria-hidden="true"]',
    ),
  ).toHaveText("฿920.00");
  await expect(
    page.locator('[aria-labelledby="wallet-balance-heading"]'),
  ).toContainText("Cash");
  const rows = page.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("−฿80.00");
  // A wallet page is a place, not a form: the tab bar stays.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  await page.getByRole("link", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/wallets\/[^/]+\/manage$/);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Back to Cash" }).click();
  await expect(
    page.getByRole("heading", { name: "Cash", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Wallets" }).click();
  await expect(page).toHaveURL(/\/wallets$/);
});

test("archive and unarchive preserve totals and support management", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Retired cash",
    openingAmount: "12000.50",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Retired cash", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await expect(
    page.getByRole("heading", { name: "Correct opening balance" }),
  ).toBeVisible();

  await page.getByLabel("Opening balance (THB)").fill("12000.75");
  await page.getByRole("button", { name: "Save opening correction" }).click();
  await expect(page.getByRole("status")).toContainText("corrected");
  await expect(page.getByLabel("Opening balance (THB)")).toHaveValue(
    "12000.75",
  );

  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/manage$/);
  await page.goto("/wallets");
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .getByText("Cash · Archived", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toContainText(
    "฿12,000.75",
  );

  await page.getByRole("link", { name: "Retired cash", exact: true }).click();
  const balance = page.locator('[aria-labelledby="wallet-balance-heading"]');
  await expect(balance).toContainText("Cash · Archived");
  await expect(balance).toContainText("฿12,000.75");
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Unarchive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Archive wallet", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete wallet…" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "retained transaction or change history",
  );
});

test("deleting a wallet lands on Wallets", async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Mistake",
    openingAmount: "10",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Mistake", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Delete wallet…" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL(/\/wallets$/);
  await expect(
    page.getByRole("heading", { name: "No wallets yet" }),
  ).toBeVisible();
});
