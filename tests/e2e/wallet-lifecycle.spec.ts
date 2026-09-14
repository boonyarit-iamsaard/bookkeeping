import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test("archive and unarchive preserve totals and restore entry eligibility", async ({
  page,
}, testInfo) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Retired cash",
    openingAmount: "12000.50",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Retired cash", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Correct opening balance" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("management.png"),
    fullPage: true,
  });
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
  await page.goto("/wallets");
  await expect(page.getByRole("listitem")).toContainText("Archived");
  await expect(page.getByRole("listitem")).toContainText("฿12,000.75");
  await page.goto("/transactions/new");
  await expect(
    page.getByRole("heading", { name: "No active wallets" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("no-active-wallets.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Create or unarchive a wallet" })
    .click();
  await page.getByRole("link", { name: "Retired cash", exact: true }).click();
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
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount", { exact: true })).toBeVisible();
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.message),
  ).toEqual([]);
});
