import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { parkPointer } from "./helpers/park-pointer";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("Savings wallets split Home's spendable balance until their marker is removed", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Name").fill("Rainy day");
  await page.getByRole("radio", { name: "Bank account", exact: true }).click();
  const savings = page.getByRole("radiogroup", { name: "Savings wallet" });
  await expect(
    savings.getByRole("radio", { name: "Off", exact: true }),
  ).toBeChecked();
  await savings.getByRole("radio", { name: "On", exact: true }).click();
  await expect(
    savings.getByRole("radio", { name: "On", exact: true }),
  ).toBeChecked();
  await page.getByLabel("Opening balance").fill("800");
  await chooseDate(page.getByLabel("Opening date"), "2026-09-01");
  await page.getByRole("button", { name: "Create wallet" }).click();
  await parkPointer(page);
  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);

  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "200",
    openingDate: "2026-09-01",
  });

  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  const spendable = page.getByRole("region", {
    name: "Spendable",
    exact: true,
  });
  await expect(spendable.locator('.money [aria-hidden="true"]')).toHaveText(
    "฿200.00",
  );
  await expect(spendable.getByRole("term")).toHaveText([
    "Set aside",
    "Total balance",
  ]);
  await expect(spendable.getByRole("definition")).toHaveText([
    "฿800.00",
    "฿1,000.00",
  ]);
  await expect(spendable).toContainText("Across 2 wallets");

  await nav.getByRole("link", { name: "Wallets", exact: true }).click();
  const total = page.getByRole("region", {
    name: "Total balance",
    exact: true,
  });
  await expect(total.locator('.money [aria-hidden="true"]')).toHaveText(
    "฿1,000.00",
  );
  await expect(total.getByRole("term")).toHaveText(["Spendable", "Set aside"]);
  await expect(total.getByRole("definition")).toHaveText([
    "฿200.00",
    "฿800.00",
  ]);
  const bank = page.getByRole("listitem").filter({ hasText: "Rainy day" });
  await expect(
    bank.getByText("Bank account · Savings", { exact: true }),
  ).toBeVisible();

  await bank.getByRole("link", { name: "Rainy day", exact: true }).click();
  await page.getByRole("link", { name: "Manage", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove Savings wallet marker", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No longer a Savings wallet. Its balance now counts in Spendable.",
  );

  await page
    .getByRole("link", { name: "Back to Rainy day", exact: true })
    .click();
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await expect(total.locator('.money [aria-hidden="true"]')).toHaveText(
    "฿1,000.00",
  );
  await expect(total).toContainText("Across 2 wallets");
  await expect(total.getByRole("term")).toHaveCount(0);
  await expect(total.getByText("Set aside", { exact: true })).toHaveCount(0);
  await expect(spendable).toHaveCount(0);
});
