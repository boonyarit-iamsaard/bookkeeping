import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.setTimeout(120_000);

const itemsSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string().optional() }),
  ),
});

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

function apiUrl(path: string) {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error("The browser test has no API origin");
  }
  return `${apiOrigin}/v1/${path}`;
}

/**
 * Cash with 25 expenses, one a day through September 2026, the nth costing
 * ฿n0.00: three pages at ten rows, with date and amount in the same order.
 * Returns Cash's id.
 */
async function seedLedger(page: Page) {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "10000",
    openingDate: "2026-09-01",
  });
  const headers = { origin: new URL(page.url()).origin };
  const read = async (path: string) =>
    itemsSchema.parse(
      await (await page.request.get(apiUrl(path), { headers })).json(),
    ).items;
  const cash = (await read("wallets"))[0]?.id;
  const category = (await read("categories")).find(
    (item) => item.name === "Uncategorized" && item.kind === "expense",
  )?.id;
  if (!(cash && category)) {
    throw new Error("The seeded wallet or category was not found");
  }
  for (let day = 1; day <= 25; day += 1) {
    const response = await page.request.post(apiUrl("transactions"), {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data: {
        type: "expense",
        amount: { value: `${day}0.00`, currency: "THB" },
        walletId: cash,
        categoryId: category,
        transactionDate: `2026-09-${String(day).padStart(2, "0")}`,
        note: `Day ${day}`,
        tagIds: [],
      },
    });
    expect(response.ok()).toBe(true);
  }
  return cash;
}

test("a wallet's page sorts and pages its transactions, keeping the view in the address", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its month sections");
  const cash = await seedLedger(page);

  const table = page.getByRole("table", { name: "Transactions" });
  const rows = table.locator("[data-transaction-row]");
  const pageLabel = page.getByText(/^Page \d+ of \d+$/);
  // With no size in the address, the table opens at ten rows.
  await page.goto(`/wallets/${cash}`);
  await expect(page.getByLabel("Rows per page")).toHaveText("10");
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows).toHaveCount(10);

  await page.goto(`/wallets/${cash}?pageSize=10`);
  await expect(page.getByText("25 transactions")).toBeVisible();
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows).toHaveCount(10);
  await expect(table.getByRole("columnheader", { name: "Wallet" })).toHaveCount(
    0,
  );
  await expect(rows.first()).toContainText("25 Sep 2026");

  const next = page.getByRole("button", { name: "Next page" });
  await next.click();
  await expect(page).toHaveURL(/pageSize=10&page=2$/);
  await expect(pageLabel).toHaveText("Page 2 of 3");
  await expect(rows.first()).toContainText("15 Sep 2026");

  // Sorting returns to page 1; amount reads largest first.
  const amount = table.getByRole("columnheader", { name: "Amount" });
  await amount.getByRole("button").click();
  await expect(page).toHaveURL(/pageSize=10&sort=amount&order=desc$/);
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows.first()).toContainText("−฿250.00");

  // A reload shows the same view.
  await page.getByRole("button", { name: "Last page" }).click();
  await expect(rows).toHaveCount(5);
  await page.reload();
  await expect(pageLabel).toHaveText("Page 3 of 3");
  await expect(rows.first()).toContainText("−฿50.00");

  // More rows per page returns to page 1.
  await chooseOption(page.getByLabel("Rows per page"), "25");
  await expect(pageLabel).toHaveText("Page 1 of 1");
  await expect(rows).toHaveCount(25);

  // An old link past the last page offers the way back.
  await page.goto(`/wallets/${cash}?pageSize=10&page=9`);
  await expect(
    page.getByRole("heading", { name: "Page 9 is past the end" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to page 3" }).click();
  await expect(pageLabel).toHaveText("Page 3 of 3");
});

test("a wallet's row menu deletes and stays on the wallet's page", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its month sections");
  const cash = await seedLedger(page);

  await page.goto(`/wallets/${cash}?pageSize=10`);
  const rows = page
    .getByRole("table", { name: "Transactions" })
    .locator("[data-transaction-row]");
  const newest = rows.filter({ hasText: "25 Sep 2026" });
  await newest.getByRole("button", { name: /^Actions for/ }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Edit",
    "Refund",
    "Delete",
  ]);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page).toHaveURL(
    new RegExp(`/wallets/${cash}\\?pageSize=10&deleted=1$`),
  );
  await expect(page.getByText("Transaction deleted.")).toBeVisible();
  await expect(page.getByText("24 transactions")).toBeVisible();
  await expect(newest).toHaveCount(0);
});
