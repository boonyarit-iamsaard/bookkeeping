import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("transfer From → To and swap survive a lost response, then edit and delete update both balances", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  if (testInfo.project.name === "phone") {
    await page.setViewportSize({ width: 360, height: 800 });
  }
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Savings",
    openingAmount: "0",
    openingDate: "2026-09-05",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await page.getByLabel("Amount").fill("1000.01");
  const dateBefore = await page
    .getByLabel("Date", { exact: true })
    .boundingBox();
  await page.getByRole("radio", { name: "Transfer" }).click();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveCount(0);
  await expect(page.getByLabel("From", { exact: true })).toContainText("Cash");
  await expect(page.getByLabel("To", { exact: true })).toContainText("Savings");
  const dateAfter = await page
    .getByLabel("Date", { exact: true })
    .boundingBox();
  expect(
    Math.abs((dateAfter?.y ?? 0) - (dateBefore?.y ?? 0)),
  ).toBeLessThanOrEqual(48);
  await page.getByRole("button", { name: "Swap wallets" }).click();
  await expect(
    page.getByRole("button", { name: "Swap wallets" }),
  ).toBeFocused();
  await expect(page.getByLabel("From", { exact: true })).toContainText(
    "Savings",
  );
  await expect(page.getByLabel("To", { exact: true })).toContainText("Cash");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-04");
  await page
    .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
    .click();
  await expect(page.locator("#transactionDate-error")).toContainText(
    "5 Sep 2026",
  );
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-05");
  // The same wallet on both sides: pick From's current choice under To.
  await chooseOption(page.getByLabel("To", { exact: true }), "Savings");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.locator("#destinationWalletId-error")).toContainText(
    "different destination",
  );
  await chooseOption(page.getByLabel("To", { exact: true }), "Cash");
  await expect(
    page.getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" }),
  ).toBeEnabled();

  if (testInfo.project.name === "phone") {
    // Approximate the space left above a native keyboard; Playwright does not open one.
    await page.setViewportSize({ width: 360, height: 420 });
    const note = page.getByLabel("Note", { exact: false });
    await note.click();
    const noteBox = await note.boundingBox();
    const saveBox = await page
      .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
      .boundingBox();
    expect(noteBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    if (noteBox && saveBox) {
      expect(noteBox.y + noteBox.height).toBeLessThan(saveBox.y);
      expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(420);
      expect(saveBox.height).toBeGreaterThanOrEqual(48);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    if (process.env.TRANSFER_SCREENSHOTS) {
      await page.screenshot({
        path: ".impeccable/review/transfer-keyboard-phone.png",
      });
    }
    await page.setViewportSize({ width: 360, height: 800 });
  }

  if (process.env.TRANSFER_SCREENSHOTS) {
    await page.getByLabel("Amount").blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/transfer-create-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  let dropped = false;
  await page.route("**/transactions/new", async (route) => {
    if (dropped || !route.request().headers()["next-action"]) {
      await route.continue();
      return;
    }
    dropped = true;
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "response to your last save was lost",
  );
  await expect(page.getByLabel("From", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("To", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Swap wallets" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Check and retry save" }).click();
  // Run alone, the list, detail, and edit routes compile cold in dev mode.
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  const row = page.locator("[data-transaction-row]");
  await expect(row).toContainText("Transfer");
  await expect(row).toContainText("Savings → Cash");
  await row.getByRole("link").click();
  await expect(page.locator("dl")).toContainText("FromSavings", {
    timeout: 15_000,
  });
  await expect(page.locator("dl")).toContainText("ToCash");
  await expect(page.getByText("Category", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit transfer" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "Swap wallets" }).click();
  await page.getByLabel("Amount").fill("500");
  if (process.env.TRANSFER_SCREENSHOTS) {
    await page.getByLabel("Amount").blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/transfer-edit-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  // Enter submits from the amount; the phone uses the same form contract.
  await page.getByLabel("Amount").press("Enter");
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  const savedId = new URL(page.url()).searchParams.get("saved");
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Cash/ }),
  ).toContainText("฿11,500.00");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Savings" }),
  ).toContainText("฿500.00");
  await page.goto(`/transactions/${savedId}/edit`);
  await page.getByRole("button", { name: "Delete transfer" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this transfer?",
  });
  await expect(dialog).toContainText("Cash → Savings");
  await expect(dialog).toContainText("both wallet balances");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\?deleted=1$/, {
    timeout: 15_000,
  });
  await expect(page.locator("[data-transaction-row]")).toHaveCount(0);
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Cash/ }),
  ).toContainText("฿12,000.00");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Savings" }),
  ).toContainText("฿0.00");
});

test("one wallet explains why a transfer cannot be saved", async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("radio", { name: "Transfer" }).click();
  await expect(
    page.getByText("Transfers need two active wallets."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save/ })).toBeDisabled();
  await page.getByRole("radio", { name: "Expense" }).click();
  await expect(
    page.getByRole("button", { name: "Save −฿10.00 · Cash" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Uncategorized",
  );
});
