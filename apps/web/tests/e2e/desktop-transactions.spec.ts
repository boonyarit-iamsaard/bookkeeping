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

test("desktop history is one table with month rows, a live filter bar, and a wallet page of the same rows", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its lists and filter sheet");
  const { cash, savings, lunch } = await seedLedger(page);

  await page.goto("/transactions");
  const table = page.getByRole("table", { name: "Transactions" });
  await expect(table.locator("thead").getByRole("columnheader")).toHaveText([
    "Date",
    "Category",
    "Wallet",
    "Tags",
    "Note",
    "Amount",
  ]);
  await expect(table.locator("[data-month-row]")).toHaveText([
    "September 2026",
    "August 2026",
  ]);
  const rows = table.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Transfer");
  await expect(rows.nth(0)).toContainText("Cash → Savings");
  await expect(rows.nth(0)).toContainText("฿100.00");
  await expect(rows.nth(0)).not.toContainText(/[+−]฿/);
  await expect(rows.nth(1)).toContainText("Refund");
  await expect(rows.nth(1)).toContainText("+฿20.00");
  await expect(rows.nth(2)).toContainText("Lunch");
  await expect(rows.nth(2)).toContainText("Coffee");
  await expect(rows.nth(2)).toContainText("−฿80.00");
  await expect(
    page.getByRole("button", { name: "Filter", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(
    0,
  );

  // The filter bar writes the address at once; there is nothing to apply.
  const bar = page.getByRole("search", { name: "Filter transactions" });
  await expect(bar.getByRole("button", { name: "Clear filters" })).toHaveCount(
    0,
  );
  await chooseOption(bar.getByLabel("Type", { exact: true }), "Expense");
  await expect(page).toHaveURL(/\/transactions\?type=expense$/);
  await expect(rows).toHaveCount(2);
  await bar.getByRole("button", { name: /^Tags/ }).click();
  await page
    .getByRole("dialog")
    .locator("label", { hasText: "Coffee" })
    .click();
  await expect(page).toHaveURL(/type=expense&tagId=/);
  await expect(rows).toHaveCount(1);
  await expect(bar.getByRole("button", { name: /^Tags/ })).toHaveText(
    "Tags · 1",
  );
  await page.keyboard.press("Escape");
  await bar.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(rows).toHaveCount(4);

  await chooseDate(bar.getByLabel("To", { exact: true }), "2026-08-31");
  await expect(page).toHaveURL(/to=2026-08-31$/);
  await expect(table.locator("[data-month-row]")).toHaveText(["August 2026"]);
  await expect(rows).toHaveCount(1);
  await chooseOption(bar.getByLabel("Type", { exact: true }), "Income");
  await expect(page.getByText("No matching transactions")).toBeVisible();
  await expect(table).toHaveCount(0);
  await bar.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(4);

  // Invalid filters keep their values in the bar and say what is wrong.
  await page.goto("/transactions?from=2026-09-03&to=2026-09-01");
  await expect(page.getByRole("alert")).toHaveText(
    "From date must be on or before To date.",
  );
  await expect(bar.getByLabel("From", { exact: true })).toHaveText(
    "3 Sep 2026",
  );
  await expect(bar.getByLabel("To", { exact: true })).toHaveText("1 Sep 2026");

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
  ).toHaveText(["Date", "Category", "Tags", "Note", "Amount"]);
  await expect(walletTable.locator("[data-month-row]")).toHaveCount(2);
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

  await page.goto("/wallets");
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Current balance" }),
  ).toContainText("฿1,000.00");
  await expect(page.getByText("No transactions yet")).toBeVisible();
});
