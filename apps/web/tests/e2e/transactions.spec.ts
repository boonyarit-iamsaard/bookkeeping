import {
  APP_TIME_ZONE,
  formatCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(150_000);

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

/** Records one expense through the form and lands on its detail page. */
async function recordExpenseThroughForm(
  page: Page,
  {
    amount,
    note,
    transactionDate,
  }: Readonly<{ amount: string; note: string; transactionDate?: string }>,
) {
  await page.goto("/transactions/new");
  // The first visit of a run waits on the dev server's cold transforms.
  await expect(page.getByLabel("Amount")).toBeFocused({ timeout: 30_000 });
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Note", { exact: false }).fill(note);
  if (transactionDate) {
    await chooseDate(page.getByLabel("Date", { exact: true }), transactionDate);
  }
  await page.getByRole("button", { name: /^Save −/ }).click();
  await expectSavedRecord(page);
  await page
    .locator("[data-transaction-row][data-saved]")
    .getByRole("link")
    .first()
    .click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+$/);
}

/**
 * Fails when the element's text is cut short: by its own ellipsis, by an
 * ancestor inside its row that hides overflow, or by running past the row or
 * the screen. Half a pixel absorbs subpixel rounding.
 */
async function expectUnclipped(locator: Locator) {
  await expect(locator).toBeVisible();
  const clipped = await locator.evaluate((element) => {
    if (element.scrollWidth > element.clientWidth) {
      return true;
    }
    const right = element.getBoundingClientRect().right;
    const row = element.closest("[data-transaction-row]");
    if (
      !row ||
      right > row.getBoundingClientRect().right + 0.5 ||
      right > window.innerWidth + 0.5
    ) {
      return true;
    }
    for (
      let ancestor = element.parentElement;
      ancestor && !ancestor.hasAttribute("data-transaction-row");
      ancestor = ancestor.parentElement
    ) {
      if (
        getComputedStyle(ancestor).overflowX !== "visible" &&
        right > ancestor.getBoundingClientRect().right + 0.5
      ) {
        return true;
      }
    }
    return false;
  });
  expect(clipped).toBe(false);
}

test("history rows show the whole financial date beside long wallets, notes and amounts", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "KBank Savings for Household Bills",
    openingAmount: "5000000",
    openingDate: "2026-09-01",
  });
  const note = "September salary top-up for the condo";
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused({ timeout: 30_000 });
  await page.getByLabel("Amount").fill("1234567.89");
  await page.getByLabel("Note", { exact: false }).fill(note);
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-20");
  await page.getByRole("button", { name: /^Save −/ }).click();
  await expectSavedRecord(page);
  await createWalletThroughForm(page, {
    name: "Pocket",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });

  await page.goto("/wallets");
  await page
    .getByRole("link", {
      name: "KBank Savings for Household Bills",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "KBank Savings for Household Bills",
      level: 1,
    }),
  ).toBeVisible();
  const walletPage = page.url();
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("300");
  await page.getByRole("radio", { name: "Transfer" }).click();
  await chooseOption(
    page.getByLabel("From", { exact: true }),
    "KBank Savings for Household Bills",
  );
  await chooseOption(page.getByLabel("To", { exact: true }), "Pocket");
  await page
    .getByRole("button", {
      name: "Save ฿300.00 KBank Savings for Household Bills → Pocket",
    })
    .click();
  await expectSavedRecord(page);

  const today = formatCalendarDate(todayIn({ timeZone: APP_TIME_ZONE }));
  for (const url of ["/", "/transactions", walletPage]) {
    await page.goto(url);
    const expense = page
      .locator("[data-transaction-row]")
      .filter({ hasText: "Expense" });
    await expectUnclipped(expense.getByText("20 Sep 2026", { exact: true }));
    await expect(expense.getByText(note)).toBeVisible();
    const transfer = page
      .locator("[data-transaction-row]")
      .filter({ hasText: "Transfer" });
    await expectUnclipped(transfer.getByText(today, { exact: true }));
  }

  // The wallet page is already that wallet's; its rows don't repeat the name.
  const rows = page.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) {
    await expect(row).not.toContainText("KBank");
  }
  await expect(
    rows
      .filter({ hasText: "Transfer" })
      .getByText("To Pocket", { exact: true }),
  ).toBeVisible();
  // The receiving wallet's page names where the money came from.
  await page.goto("/wallets");
  await page.getByRole("link", { name: "Pocket", exact: true }).click();
  const pocketRow = page.locator("[data-transaction-row]");
  await expect(pocketRow).toHaveCount(1);
  await expect(
    pocketRow.getByText("From KBank Savings for Household Bills", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(pocketRow).not.toContainText("Pocket");
});

test("editing loads the saved values, keeps the type fixed, and replaces the balance effect", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });
  await recordExpenseThroughForm(page, { amount: "120", note: "Coffee" });
  const detailUrl = page.url();
  // The address changes before the detail renders; read the detail itself.
  const recorded = await page
    .locator("dl")
    .getByText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/)
    .textContent();

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+\/edit$/);
  await expect(
    page.getByRole("heading", { name: "Edit expense" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("120.00");
  await expect(page.getByLabel("Note", { exact: false })).toHaveValue("Coffee");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("The type is fixed once saved")).toBeVisible();
  await expect(page.getByText(/^Recorded .* Bangkok time/)).toContainText(
    recorded?.replace(/ Bangkok time$/, "") ?? "",
  );

  // Escape leaves the edit where it began.
  await page.getByLabel("Note", { exact: false }).press("Escape");
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  await page.getByLabel("Amount").fill("150.5");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-02");
  const category = page.getByRole("button", { name: /^Category/ });
  await expect(category).toHaveText("Uncategorized");
  await category.click();
  const categorySheet = page.getByRole("dialog");
  await expect(
    categorySheet.getByRole("button", { name: "Close" }),
  ).toBeVisible();
  await categorySheet
    .getByRole("button", { name: "New category", exact: true })
    .click();
  await expect(
    categorySheet.getByRole("heading", { name: "New expense category" }),
  ).toBeVisible();
  await expect(
    categorySheet.getByRole("button", { name: "Back to search" }),
  ).toBeVisible();
  await categorySheet.getByRole("button", { name: "Close" }).click();
  await expect(categorySheet).toBeHidden();

  await category.click();
  await page
    .getByRole("dialog", { name: "Expense category" })
    .getByRole("button", { name: "Groceries", exact: true })
    .click();
  await expect(category).toHaveText("Food & Drink › Groceries");
  await page.getByLabel("Note", { exact: false }).fill("Coffee and cake");
  await page.getByRole("button", { name: "Save −฿150.50 · Cash" }).click();

  await expectSavedRecord(page);
  const row = page.locator("[data-transaction-row][data-saved]");
  await expect(row).toContainText("−฿150.50");
  await expect(row).toContainText("Groceries");
  await expect(row).toContainText("2 Sep 2026");
  await expect(row).toContainText("Coffee and cake");
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);

  // The detail re-reads the correction without a reload.
  await row.getByRole("link").first().click();
  await expect(page.locator("dl")).toContainText("Coffee and cake");
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿11,849.50");
});

test("an invalid edit keeps the values and names the field; deleting removes the record and its effect", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordExpenseThroughForm(page, { amount: "80", note: "Mistake" });
  await page.getByRole("link", { name: "Edit" }).click();

  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-08-31");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "opened on 1 Sep 2026" }),
  ).toBeVisible();
  await expect(page.locator("input[name=transactionDate]")).toHaveValue(
    "2026-08-31",
  );
  await expect(page.getByLabel("Date")).toHaveAttribute(
    "aria-describedby",
    "transactionDate-error",
  );
  await expect(page).toHaveURL(/\/edit$/);

  await page.getByRole("button", { name: "Delete expense" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  // The confirmation reads the saved record back, not the unsaved edit.
  await expect(dialog).toContainText(
    `−฿80.00 · Cash on ${formatCalendarDate(todayIn({ timeZone: APP_TIME_ZONE }))}`,
  );
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("input[name=transactionDate]")).toHaveValue(
    "2026-08-31",
  );

  await page.getByRole("button", { name: "Delete expense" }).click();
  const deletionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      /\/v1\/transactions\/[0-9a-f-]+$/.test(response.url()),
  );
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  expect((await deletionResponse).status()).toBe(204);

  await expect(page).toHaveURL(/\/transactions\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("Transaction deleted");
  await expect(page.locator("[data-transaction-row]")).toHaveCount(0);
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿500.00");
});

test("a correction keeps its archived wallet, cannot go below its refunds, and an edited refund reads the allowance back", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Bank",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });

  // A ฿500 expense with a ฿100 refund, both in Cash.
  await recordExpenseThroughForm(page, {
    amount: "500",
    note: "Kettle",
    transactionDate: "2026-09-02",
  });
  const expenseId = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("link", { name: "Record refund" }).click();
  await expect(
    page.getByRole("heading", { name: "Record refund" }),
  ).toBeVisible();
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Save +฿100.00 · Cash" }).click();
  await expectSavedRecord(page);

  // Archive Cash: new entries lose it, but the expense keeps it on edit.
  await page.goto("/wallets");
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();
  await page.goto("/transactions/new");
  const newWallet = page.getByLabel("Wallet", { exact: true });
  await expect(newWallet).toContainText("Bank");
  await newWallet.click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option", { name: /^Bank/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`/transactions/${expenseId}/edit`);
  await expect(
    page.getByRole("heading", { name: "Edit expense" }),
  ).toBeVisible();
  const wallet = page.getByLabel("Wallet", { exact: true });
  await expect(wallet).toContainText("Cash");
  await expect(wallet).toContainText("Archived");
  await wallet.click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(
    page.getByRole("option", { name: /^Cash/ }).filter({ hasText: "Archived" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("฿100.00 of this expense has been refunded"),
  ).toBeVisible();

  // The server holds the amount to what its refunds return; values stay.
  await page.getByLabel("Amount").fill("50");
  await page.getByRole("button", { name: "Save −฿50.00 · Cash" }).click();
  await expect(page.locator("#amount-error")).toHaveText(
    "฿100.00 of this expense has been refunded; the amount cannot go below that",
  );
  await expect(page.getByLabel("Amount")).toHaveValue("50");
  await expect(page).toHaveURL(/\/edit$/);

  // Deleting is blocked while the refund counts against the expense.
  await page.getByRole("button", { name: "Delete expense" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    `This expense has linked refunds: ฿100.00 on ${formatCalendarDate(todayIn({ timeZone: APP_TIME_ZONE }))}. Delete each refund first`,
  );
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();

  // Editing the refund adds its own amount back to the allowance shown.
  await page.goto(`/transactions/${expenseId}`);
  await page
    .getByRole("list", { name: "Linked refunds" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Refund" })).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit refund" }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^Refund of Uncategorized/ }),
  ).toContainText("฿500.00 left");
  await expect(page.getByLabel("Amount")).toHaveValue("100.00");
  await expect(page.getByLabel("Received in")).toContainText("Cash");
  await expect(page.getByLabel("Received in")).toContainText("Archived");
  await page.getByLabel("Amount").fill("150");
  await page.getByRole("button", { name: "Save +฿150.00 · Cash" }).click();
  await expectSavedRecord(page);
  await page.goto(`/transactions/${expenseId}`);
  await expect(page.getByText("฿150.00 refunded")).toBeVisible();
  await expect(page.getByText("฿350.00 left")).toBeVisible();
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: /^Cash/ }),
  ).toContainText("฿650.00");
});
