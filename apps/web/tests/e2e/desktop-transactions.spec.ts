import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.setTimeout(120_000);

const idCollectionSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string().optional() }),
  ),
});
const idSchema = z.object({ id: z.string() });

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

/** Posts to the API as the signed-in user; resolves to the created record's id. */
function poster(page: Page) {
  return async (path: string, data: object) => {
    const apiOrigin = process.env.VITE_API_ORIGIN;
    if (!apiOrigin) {
      throw new Error("The browser test has no API origin");
    }
    const response = await page.request.post(`${apiOrigin}/v1/${path}`, {
      headers: {
        origin: new URL(page.url()).origin,
        "idempotency-key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return idSchema.parse(await response.json()).id;
  };
}

async function read(page: Page, path: string) {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  const response = await page.request.get(`${apiOrigin}/v1/${path}`, {
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.ok()).toBe(true);
  return idCollectionSchema.parse(await response.json()).items;
}

const thb = (value: string) => ({ value, currency: "THB" });

/**
 * Cash and Savings with four records over two months: a tagged expense, an
 * older expense, a transfer and a refund of the first expense.
 */
async function seedLedger(page: Page) {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-08-01",
  });
  await createWalletThroughForm(page, {
    name: "Savings",
    openingAmount: "0",
    openingDate: "2026-08-01",
  });
  const wallets = await read(page, "wallets");
  const cash = wallets.find((wallet) => wallet.name === "Cash")?.id;
  const savings = wallets.find((wallet) => wallet.name === "Savings")?.id;
  const categories = await read(page, "categories");
  const category = categories.find(
    (item) => item.name === "Uncategorized" && item.kind === "expense",
  )?.id;
  if (!(cash && savings && category)) {
    throw new Error("The seeded wallets or category were not found");
  }
  const post = poster(page);
  const coffee = await post("tags", { name: "Coffee" });
  const lunch = await post("transactions", {
    type: "expense",
    amount: thb("80.00"),
    walletId: cash,
    categoryId: category,
    transactionDate: "2026-09-10",
    note: "Lunch",
    tagIds: [coffee],
  });
  await post("transactions", {
    type: "refund",
    amount: thb("20.00"),
    walletId: cash,
    refundOfTransactionId: lunch,
    transactionDate: "2026-09-11",
    note: "",
  });
  await post("transactions", {
    type: "transfer",
    amount: thb("100.00"),
    walletId: cash,
    destinationWalletId: savings,
    transactionDate: "2026-09-12",
    note: "",
  });
  await post("transactions", {
    type: "expense",
    amount: thb("50.00"),
    walletId: cash,
    categoryId: category,
    transactionDate: "2026-08-20",
    note: "August groceries",
    tagIds: [],
  });
  return { cash, savings, lunch };
}

test("desktop history is one table with a Filters popover, and a wallet page of the same rows", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its lists and filter sheet");
  const { cash, savings, lunch } = await seedLedger(page);

  await page.goto("/transactions");
  const table = page.getByRole("table", { name: "Transactions" });
  await expect(table.locator("thead").getByRole("columnheader")).toHaveText([
    "Date",
    "Type",
    "Category",
    "Wallet",
    "Tags",
    "Amount",
    "Actions",
  ]);
  const rows = table.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Transfer");
  await expect(rows.nth(0)).toContainText("Cash → Savings");
  await expect(rows.nth(0)).toContainText("฿100.00");
  await expect(rows.nth(0)).not.toContainText(/[+−]฿/);
  await expect(rows.nth(1)).toContainText("Refund");
  await expect(rows.nth(1)).toContainText("+฿20.00");
  await expect(rows.nth(2)).toContainText("Coffee");
  await expect(rows.nth(2)).toContainText("−฿80.00");
  await expect(
    page.getByRole("button", { name: "Filter", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(
    0,
  );

  // Filters opens a popover that writes the address at once; there is
  // nothing to apply, no filter bar above the table and no type tabs.
  await expect(
    page.getByRole("search", { name: "Filter transactions" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Transaction type" }),
  ).toHaveCount(0);
  const filters = page.getByRole("button", { name: /^Filters/ });
  await expect(filters).toHaveText("Filters");
  await filters.click();
  const bar = page.getByRole("search", { name: "Filter transactions" });
  await expect(bar.getByRole("button", { name: "Clear filters" })).toHaveCount(
    0,
  );
  await chooseOption(bar.getByLabel("Wallet", { exact: true }), "Cash");
  await chooseOption(bar.getByLabel("Type", { exact: true }), "Expense");
  await expect(page).toHaveURL(/\/transactions\?walletId=.+&type=expense$/);
  await expect(rows).toHaveCount(2);
  await expect(filters).toHaveText("Filters · 2");
  // Tags are pills in the same popover, not a second one.
  await bar.locator("label", { hasText: "Coffee" }).click();
  await expect(page).toHaveURL(/type=expense&tagId=/);
  await expect(rows).toHaveCount(1);
  await expect(filters).toHaveText("Filters · 3");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);

  // The active filters are chips at the toolbar's start, each ✕ lifting its own.
  const chips = page.getByRole("list", { name: "Active filters" });
  await expect(chips.getByRole("listitem")).toHaveText([
    "WalletCash",
    "TypeExpense",
    "TagCoffee",
  ]);
  const removeType = page.getByRole("button", {
    name: "Remove type filter: Expense",
  });
  await removeType.focus();
  await expect(removeType).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/transactions\?walletId=[^&]+&tagId=[^&]+$/);
  await expect(chips.getByRole("listitem")).toHaveText([
    "WalletCash",
    "TagCoffee",
  ]);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(chips).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear all" })).toHaveCount(0);

  // No match is a message inside the card, under the same toolbar.
  await page.goto("/transactions?pageSize=25&sort=amount&order=asc");
  await filters.click();
  await chooseDate(bar.getByLabel("To", { exact: true }), "2026-08-31");
  await expect(page).toHaveURL(/to=2026-08-31$/);
  await expect(rows).toHaveCount(1);
  await chooseOption(bar.getByLabel("Type", { exact: true }), "Income");
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  const card = page.getByRole("region", { name: "No matching transactions" });
  await expect(card).toContainText(
    "Try a wider date range, or clear the filters to see all your history.",
  );
  await expect(table).toHaveCount(0);
  // One card holds the toolbar and the message.
  const tableCard = page.locator(".shadow-card").filter({ has: filters });
  await expect(tableCard.filter({ has: card })).toHaveCount(1);
  await expect(page.getByText("Rows per page")).toHaveCount(0);
  await expect(filters).toHaveText("Filters · 2");
  await expect(page.getByRole("button", { name: "Columns" })).toBeVisible();
  await expect(chips.getByRole("listitem")).toHaveCount(2);
  await card.getByRole("link", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(4);
  const cleared = new URL(page.url()).searchParams;
  expect(Object.fromEntries(cleared)).toEqual({
    pageSize: "25",
    sort: "amount",
    order: "asc",
  });

  // An invalid filter says what is wrong inside the card, and Filters still reads it.
  await page.goto("/transactions?from=2026-09-03&to=2026-09-01");
  await expect(tableCard.getByRole("alert")).toHaveText(
    "From date must be on or before To date.",
  );
  await filters.click();
  await expect(bar.getByLabel("From", { exact: true })).toContainText(
    "3 Sep 2026",
  );
  await expect(bar.getByLabel("To", { exact: true })).toContainText(
    "1 Sep 2026",
  );
  await page.keyboard.press("Escape");
  // A bad value is a visibly invalid chip, and the notice sits under the toolbar.
  await page.goto("/transactions?walletId=gone&type=expense");
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("Choose a valid wallet.");
  await expect(
    page.getByRole("list", { name: "Active filters" }).getByRole("listitem"),
  ).toHaveText(["WalletgoneNot a value the history accepts", "TypeExpense"]);
  await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();
  const filtersBox = await filters.boundingBox();
  const alertBox = await alert.boundingBox();
  if (!(filtersBox && alertBox)) {
    throw new Error("The toolbar or notice has no box");
  }
  expect(alertBox.y).toBeGreaterThan(filtersBox.y + filtersBox.height);
  const removeGone = page.getByRole("button", {
    name: "Remove wallet filter: gone",
  });
  await expect(removeGone).toHaveAccessibleDescription(
    "Not a value the history accepts",
  );
  await removeGone.click();
  await expect(page).toHaveURL(/\/transactions\?type=expense$/);
  await expect(table).toBeVisible();

  // The whole row opens the record, wherever it is clicked.
  await page.goto("/transactions");
  await rows.nth(2).click({ position: { x: 300, y: 10 } });
  await expect(page).toHaveURL(new RegExp(`/transactions/${lunch}$`));

  // Wallet page: name and Manage left, the balance as a figure right, no filters.
  await page.goto(`/wallets/${cash}`);
  const heading = page.getByRole("heading", { name: "Cash", level: 1 });
  const balance = page.getByRole("region", { name: "Current balance" });
  await expect(balance).toContainText("฿790.00");
  const headingBox = await heading.boundingBox();
  const manageBox = await page
    .getByRole("link", { name: "Manage" })
    .boundingBox();
  const balanceBox = await balance.boundingBox();
  if (!(headingBox && manageBox && balanceBox)) {
    throw new Error("The wallet header has no box");
  }
  expect(manageBox.x).toBeGreaterThan(headingBox.x);
  expect(manageBox.x).toBeLessThan(balanceBox.x);
  const walletTable = page.getByRole("table", { name: "Transactions" });
  await expect(
    walletTable.locator("thead").getByRole("columnheader"),
  ).toHaveText(["Date", "Type", "Category", "Tags", "Amount", "Actions"]);
  await expect(walletTable.locator("[data-transaction-row]")).toHaveCount(4);
  await expect(
    walletTable.locator("[data-transaction-row]").first(),
  ).toContainText("To Savings");
  await expect(page.getByRole("search")).toHaveCount(0);

  await page.goto(`/wallets/${savings}`);
  await expect(
    page.getByRole("region", { name: "Current balance" }),
  ).toContainText("฿100.00");
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(page.locator("[data-transaction-row]")).toContainText(
    "From Cash",
  );
});

test("desktop history loads without sample money and reads an empty ledger as empty", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its lists and filter sheet");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.route("**/v1/transactions*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Transactions", exact: true })
    .click();
  await expect(page.getByText("Loading your records…")).toBeAttached();
  await expect(page.getByText(/฿/)).toHaveCount(0);

  await expect(page.getByText("Nothing recorded yet")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("search")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filters/ })).toHaveCount(0);
  await expect(page.getByText("No matching transactions")).toHaveCount(0);

  await page.goto("/wallets");
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Current balance" }),
  ).toContainText("฿1,000.00");
  await expect(page.getByText("No transactions yet")).toBeVisible();
});
