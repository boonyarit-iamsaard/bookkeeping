import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a new user creates a wallet and its opening balance survives a reload", async ({
  page,
}) => {
  await signUpFreshUser(page);

  await page.goto("/wallets");
  await expect(
    page.getByRole("heading", { name: "No wallets yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create your first wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/new$/);
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();

  await page.getByLabel("Name").fill("Kasikorn savings");
  await page.getByRole("radio", { name: "Bank account" }).click();
  await page.getByLabel("Opening balance").fill("12000.5");
  await chooseDate(page.getByLabel("Opening date"), "2026-09-01");
  await page.getByRole("button", { name: "Create wallet" }).click();

  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Kasikorn savings" });
  await expect(row).toContainText("Bank account");
  await expect(row).toContainText("Opened 1 Sep 2026");
  await expect(row).toContainText("฿12,000.50");
  await expect(
    page.locator(
      '[aria-labelledby="total-balance-heading"] .money [aria-hidden="true"]',
    ),
  ).toHaveText("฿12,000.50");

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Kasikorn savings" }),
  ).toContainText("฿12,000.50");

  // The row opens the wallet's own page, led by its balance.
  await page
    .getByRole("link", { name: "Kasikorn savings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kasikorn savings", level: 1 }),
  ).toBeVisible();
  const balance = page.locator('[aria-labelledby="wallet-balance-heading"]');
  await expect(balance).toContainText("฿12,000.50");
  await expect(balance).toContainText("Bank account");
  await expect(page.getByText("No transactions yet")).toBeVisible();
});

test("validation names the problem and keeps the typed values", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();

  await page.getByLabel("Name").fill("Petty cash");
  await page.getByLabel("Opening balance").fill("1.005");
  await page.getByRole("button", { name: "Create wallet" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "at most two decimals" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Petty cash");
  await expect(page.getByLabel("Opening balance")).toHaveValue("1.005");
  await expect(page).toHaveURL(/\/wallets\/new$/);
});

test("double-tapping Save creates one wallet", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Name").fill("Double-tap cash");
  await page.getByLabel("Opening balance").fill("25");

  await page
    .getByRole("button", { name: "Create wallet" })
    .evaluate((element) => {
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error("The create control is not a button");
      }
      element.click();
      element.click();
    });

  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Double-tap cash" }),
  ).toHaveCount(1);
});
