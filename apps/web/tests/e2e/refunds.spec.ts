import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a linked refund starts from the expense, falls back when the original wallet is archived, and exhausts the allowance", async ({
  page,
}) => {
  test.setTimeout(150_000);
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
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-02");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expectSavedRecord(page);
  await page.locator("[data-transaction-row]").getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "Refunds", exact: true }),
  ).toBeVisible();
  const expenseId = new URL(page.url()).pathname.split("/")[2];
  await expect(page.getByText("None recorded")).toBeVisible();

  // The general picker never offers Refund; the expense does.
  await page.goto("/transactions/new");
  await expect(page.getByRole("radio", { name: "Refund" })).toHaveCount(0);
  await page.goto(`/transactions/${expenseId}`);
  await page.getByRole("link", { name: "Record refund" }).click();
  await expect(
    page.getByRole("heading", { name: "Record refund" }),
  ).toBeVisible();
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
  await expect(page.getByLabel("Received in")).toContainText("Cash");
  await page.getByLabel("Amount").fill("600");
  await page.getByRole("button", { name: "Save +฿600.00 · Cash" }).click();
  await expect(page.locator("#amount-error")).toContainText(
    "Only ฿500.00 of this expense is left",
  );
  await expect(page.getByLabel("Amount")).toHaveValue("600");
  await page.getByLabel("Amount").fill("100");
  // A refund cannot precede its expense, so the calendar refuses the day.
  await page.getByLabel("Date", { exact: true }).click();
  await expect(page.locator('[data-date="2026-09-01"]')).toBeDisabled();
  await page.locator('[data-date="2026-09-02"]').click();
  // Enter submits from the amount on every device.
  await page.getByLabel("Amount").press("Enter");
  await expectSavedRecord(page);
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
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("฿100.00 refunded")).toBeVisible();
  await expect(page.getByText("฿400.00 left")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Linked refunds" }),
  ).toContainText("Cash (Archived)");
  await page.getByRole("link", { name: "Record refund" }).click();
  await expect(
    page.getByRole("heading", { name: "Record refund" }),
  ).toBeVisible();
  const receivingWallet = page.getByLabel("Received in");
  await expect(receivingWallet).toContainText("Choose an active wallet");
  // Only the active wallet is offered; the archived original is absent.
  await receivingWallet.click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option", { name: /^Bank/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Cash, the expense’s wallet, is archived"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "unarchive Cash" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("400.00");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await chooseOption(receivingWallet, "Bank");
  await page.getByLabel("Amount").fill("50");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-02");
  await page.getByRole("button", { name: "Save +฿50.00 · Bank" }).click();
  await expect(page.locator("#transactionDate-error")).toContainText(
    "opened on 3 Sep 2026",
  );
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-03");
  await page.getByRole("button", { name: "Save +฿50.00 · Bank" }).click();
  await expectSavedRecord(page);
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Bank/ }),
  ).toContainText("฿50.00");

  // Refund detail links back to the expense and names the archived wallet.
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("฿150.00 refunded")).toBeVisible();
  await expect(page.getByText("฿350.00 left")).toBeVisible();
  await page
    .getByRole("list", { name: "Linked refunds" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Refund" })).toBeVisible();
  await expect(page.locator("dl")).toContainText(
    "Refund of−฿500.00 on 2 Sep 2026",
  );
  await expect(page.locator("dl")).toContainText(
    "Received inCash · Cash · Archived",
  );

  // The rest of the allowance closes the expense to further refunds.
  await page.goto(`/transactions/${expenseId}/refund`);
  await expect(
    page.getByRole("link", { name: /^Refund of Uncategorized/ }),
  ).toContainText("฿350.00 left");
  await chooseOption(page.getByLabel("Received in"), "Bank");
  await expect(page.getByLabel("Amount")).toHaveValue("350.00");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-03");
  await page.getByRole("button", { name: "Save +฿350.00 · Bank" }).click();
  await expectSavedRecord(page);
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("Fully refunded")).toBeVisible();
  await expect(page.getByRole("link", { name: "Record refund" })).toHaveCount(
    0,
  );
});
