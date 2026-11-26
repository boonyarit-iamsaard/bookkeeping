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
}

test("desktop history sorts and pages on the server, keeping the view in the address", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its month sections");
  await seedLedger(page);

  await page.goto("/transactions");
  const table = page.getByRole("table", { name: "Transactions" });
  const rows = table.locator("[data-transaction-row]");
  const pageLabel = page.getByText(/^Page \d+ of \d+$/);
  const rowsPerPage = page.getByLabel("Rows per page");
  // With no size in the address, ten rows per page makes three pages.
  await expect(page.getByText("25 transactions")).toBeVisible();
  await expect(rowsPerPage).toHaveText("10");
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText("25 Sep 2026");
  await expect(table.locator("[data-month-row]")).toHaveCount(0);
  await expect(
    table.getByRole("columnheader", { name: "Date" }),
  ).toHaveAttribute("aria-sort", "descending");

  // A size in the address wins over the default and survives a reload.
  await chooseOption(rowsPerPage, "50");
  await expect(page).toHaveURL(/\/transactions\?pageSize=50$/);
  await page.reload();
  await expect(pageLabel).toHaveText("Page 1 of 1");
  await expect(rows).toHaveCount(25);

  // The header row stays under the top bar while the rows scroll.
  await page.mouse.wheel(0, 600);
  await expect
    .poll(async () => (await table.locator("thead").boundingBox())?.y)
    .toBe(64);

  await chooseOption(rowsPerPage, "10");
  await expect(page).toHaveURL(/\/transactions\?pageSize=10$/);
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows).toHaveCount(10);
  const first = page.getByRole("button", { name: "First page" });
  const previous = page.getByRole("button", { name: "Previous page" });
  const next = page.getByRole("button", { name: "Next page" });
  const last = page.getByRole("button", { name: "Last page" });
  await expect(first).toBeDisabled();
  await expect(previous).toBeDisabled();

  await next.click();
  await expect(page).toHaveURL(/pageSize=10&page=2$/);
  await expect(pageLabel).toHaveText("Page 2 of 3");
  await expect(rows.first()).toContainText("15 Sep 2026");
  await last.click();
  await expect(pageLabel).toHaveText("Page 3 of 3");
  await expect(rows).toHaveCount(5);
  await expect(next).toBeDisabled();
  await expect(last).toBeDisabled();
  await previous.click();
  await expect(pageLabel).toHaveText("Page 2 of 3");
  await first.click();
  await expect(page).toHaveURL(/\/transactions\?pageSize=10$/);

  // Sorting returns to page 1; amount reads largest first, then smallest.
  await next.click();
  const amount = table.getByRole("columnheader", { name: "Amount" });
  await amount.getByRole("button").click();
  await expect(page).toHaveURL(/pageSize=10&sort=amount&order=desc$/);
  await expect(amount).toHaveAttribute("aria-sort", "descending");
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await expect(rows.first()).toContainText("−฿250.00");
  await amount.getByRole("button").click();
  await expect(page).toHaveURL(/sort=amount&order=asc$/);
  await expect(rows.first()).toContainText("−฿10.00");

  // A reload shows the same view.
  await next.click();
  await page.reload();
  await expect(pageLabel).toHaveText("Page 2 of 3");
  await expect(rows.first()).toContainText("−฿110.00");

  // A filter keeps the sort and rows per page and returns to page 1.
  await page.getByRole("button", { name: /^Filters/ }).click();
  const bar = page.getByRole("search", { name: "Filter transactions" });
  await chooseOption(bar.getByLabel("Type", { exact: true }), "Expense");
  await expect(page).toHaveURL(
    /\?pageSize=10&sort=amount&order=asc&type=expense$/,
  );
  await expect(pageLabel).toHaveText("Page 1 of 3");
  await page.keyboard.press("Escape");

  // More rows per page returns to page 1 too.
  await next.click();
  await chooseOption(page.getByLabel("Rows per page"), "25");
  await expect(pageLabel).toHaveText("Page 1 of 1");
  await expect(rows).toHaveCount(25);

  // An old link past the last page offers the way back.
  await page.goto("/transactions?pageSize=10&page=9");
  await expect(
    page.getByRole("heading", { name: "Page 9 is past the end" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to page 3" }).click();
  await expect(pageLabel).toHaveText("Page 3 of 3");
  await expect(rows).toHaveCount(5);
});
