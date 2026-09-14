import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a linked refund starts from the expense, falls back when the original wallet is archived, and guards the expense", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
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
    name: "Bank",
    openingAmount: "0",
    openingDate: "2026-09-03",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });

  // The ฿500 expense the refunds hang off.
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("500");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-02");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  await page.locator("[data-transaction-row]").getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "Refunds", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  const expenseId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByText("None recorded")).toBeVisible();

  // The general picker never offers Refund; the expense does.
  await page.goto("/transactions/new");
  await expect(page.getByRole("radio", { name: "Refund" })).toHaveCount(0);
  await page.goto(`/transactions/${expenseId}`);
  await page.getByRole("link", { name: "Record refund" }).click();
  await expect(
    page.getByRole("heading", { name: "Record refund" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("radio")).toHaveCount(0);
  const chip = page.getByRole("link", { name: /^Refund of Uncategorized/ });
  await expect(chip).toContainText("−฿500.00");
  await expect(chip).toContainText("2 Sep 2026");
  await expect(chip).toContainText("฿500.00 left");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  const chipBox = await chip.boundingBox();
  const amountBox = await page.getByLabel("Amount").boundingBox();
  expect(chipBox && amountBox && chipBox.width <= amountBox.width + 1).toBe(
    true,
  );
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveCount(0);
  await expect(page.getByText("Follows the expense’s category")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("500.00");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await expect(
    page.getByLabel("Received in").locator("option:checked"),
  ).toContainText("Cash");
  await page.getByLabel("Amount").fill("600");
  await page.getByRole("button", { name: "Save +฿600.00 · Cash" }).click();
  await expect(page.locator("#amount-error")).toContainText(
    "Only ฿500.00 of this expense is left",
  );
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-01");
  await page.getByRole("button", { name: "Save +฿100.00 · Cash" }).click();
  await expect(page.locator("#transactionDate-error")).toContainText(
    "dated 2 Sep 2026",
  );
  await page.getByLabel("Date", { exact: true }).fill("2026-09-02");
  if (process.env.REFUND_SCREENSHOTS) {
    await page.getByLabel("Amount").blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/refund-create-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  // Enter submits from the amount on every device.
  await page.getByLabel("Amount").press("Enter");
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  const rows = page.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Refund · Uncategorized");
  await expect(rows.first()).toContainText("+฿100.00");
  await expect(
    rows.first().getByRole("link", { name: "View original expense" }),
  ).toHaveAttribute("href", `/transactions/${expenseId}`);

  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Cash/ }),
  ).toContainText("฿11,600.00");

  // Archive the original wallet: the receiving wallet stays unselected.
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("฿100.00 refunded")).toBeVisible();
  await expect(page.getByText("฿400.00 left")).toBeVisible();
  await page.getByRole("link", { name: "Record refund" }).click();
  await expect(
    page.getByRole("heading", { name: "Record refund" }),
  ).toBeVisible({ timeout: 15_000 });
  const receivingWallet = page.getByLabel("Received in");
  await expect(receivingWallet).toHaveValue("");
  await expect(receivingWallet.locator("option")).toHaveCount(2);
  await expect(
    page.getByText("Cash, the expense’s wallet, is archived"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "unarchive Cash" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("400.00");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  if (process.env.REFUND_SCREENSHOTS) {
    await page.screenshot({
      path: `.impeccable/review/refund-archived-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await receivingWallet.selectOption({ label: "Bank · Cash · ฿0.00" });
  await page.getByLabel("Amount").fill("50");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-02");
  await page.getByRole("button", { name: "Save +฿50.00 · Bank" }).click();
  await expect(page.locator("#transactionDate-error")).toContainText(
    "opened on 3 Sep 2026",
  );
  await page.getByLabel("Date", { exact: true }).fill("2026-09-03");
  await page.getByRole("button", { name: "Save +฿50.00 · Bank" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Bank/ }),
  ).toContainText("฿50.00");

  // The expense can no longer shrink below ฿150 or be deleted.
  await page.goto(`/transactions/${expenseId}/edit`);
  await expect(page.getByRole("heading", { name: "Edit expense" })).toBeVisible(
    { timeout: 15_000 },
  );
  await expect(
    page.getByText("฿150.00 of this expense has been refunded"),
  ).toBeVisible();
  await page.getByLabel("Amount").fill("149.99");
  await page.getByRole("button", { name: "Save −฿149.99 · Cash" }).click();
  await expect(page.locator("#amount-error")).toContainText(
    "฿150.00 of this expense has been refunded",
  );
  await page.getByLabel("Amount").fill("150");
  await page.getByRole("button", { name: "Delete expense" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "linked refunds: ฿100.00 on 2 Sep 2026, ฿50.00 on 3 Sep 2026",
  );
  if (process.env.REFUND_SCREENSHOTS) {
    await page.screenshot({
      path: `.impeccable/review/refund-blocked-${testInfo.project.name}.png`,
    });
  }
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();

  // Refund detail links back; its edit keeps the recording time and can be deleted.
  await page.goto(`/transactions/${expenseId}`);
  await page
    .getByRole("list", { name: "Linked refunds" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Refund" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("dl")).toContainText(
    "Refund of−฿500.00 on 2 Sep 2026",
  );
  await expect(page.locator("dl")).toContainText(
    "Received inCash · Cash · Archived",
  );
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit refund" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("link", { name: /^Refund of Uncategorized/ }),
  ).toContainText("฿450.00 left");
  await page.getByLabel("Amount").fill("450");
  await page.getByRole("button", { name: "Save +฿450.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/, { timeout: 15_000 });
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("Fully refunded")).toBeVisible();
  await expect(page.getByRole("link", { name: "Record refund" })).toHaveCount(
    0,
  );
});
