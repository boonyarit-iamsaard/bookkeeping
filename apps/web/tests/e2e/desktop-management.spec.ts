import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.setTimeout(120_000);
const ROUND_TRIP = { timeout: 20_000 };

const collectionSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
}

/** One Groceries expense carrying the Coffee tag, so both screens count it. */
async function seedTaggedGroceriesEntry(page: Page, baseURL: string) {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error("The browser test has no API origin");
  }
  const headers = { origin: baseURL };
  const post = (path: string, data: object) =>
    page.request.post(`${apiOrigin}${path}`, {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data,
    });
  const read = async (path: string) =>
    collectionSchema.parse(
      await (await page.request.get(`${apiOrigin}${path}`, { headers })).json(),
    ).items;
  const wallet = (await read("/v1/wallets"))[0];
  const groceries = (await read("/v1/categories")).find(
    (item) => item.name === "Groceries",
  );
  const tagResponse = await post("/v1/tags", { name: "Coffee" });
  expect(tagResponse.ok()).toBe(true);
  const tag = z.object({ id: z.string() }).parse(await tagResponse.json());
  if (!wallet || !groceries) {
    throw new Error("The seeded wallet or Groceries category was not found");
  }
  const response = await post("/v1/transactions", {
    type: "expense",
    amount: { value: "45.00", currency: "THB" },
    walletId: wallet.id,
    categoryId: groceries.id,
    transactionDate: "2026-09-01",
    note: "Groceries",
    tagIds: [tag.id],
  });
  expect(response.ok()).toBe(true);
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("desktop Categories shows both trees as tables and Tags one table", {
  tag: "@matrix",
}, async ({ page, baseURL }) => {
  test.skip(!isDesktop(page), "Phone keeps its lists");
  if (!baseURL) {
    throw new Error("The browser test has no client origin");
  }
  await signUpFreshUser(page);
  await page.goto("/tags");
  await expect(
    page.getByRole("heading", { name: "No tags yet" }),
  ).toBeVisible();
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await seedTaggedGroceriesEntry(page, baseURL);

  await page.goto("/categories");
  await expect(page.getByRole("radio", { name: "Income" })).toHaveCount(0);
  const expense = page.getByRole("table", { name: "Expense categories" });
  const income = page.getByRole("table", { name: "Income categories" });
  for (const table of [expense, income]) {
    await expect(table.getByRole("columnheader")).toHaveText([
      "Name",
      "Entries",
      "Actions",
    ]);
  }
  await expect(expense.getByRole("row", { name: /Groceries/ })).toContainText(
    "1",
  );
  await expect(income.getByRole("row", { name: /Salary/ })).toBeVisible();
  const expenseBox = await boxOf(expense);
  const incomeBox = await boxOf(income);
  expect(incomeBox.y).toBeCloseTo(expenseBox.y, 0);
  expect(incomeBox.x).toBeGreaterThan(expenseBox.x + expenseBox.width - 1);
  // A child sits one step in from its parent.
  const parent = await boxOf(
    expense.getByRole("button", { name: "Food & Drink", exact: true }),
  );
  const child = await boxOf(
    expense.getByRole("button", { name: "Groceries", exact: true }),
  );
  expect(child.x).toBeGreaterThan(parent.x);

  const sheet = page.getByRole("dialog", { name: "Edit category" });
  await expense.getByRole("button", { name: "Groceries", exact: true }).click();
  await expect(sheet.getByLabel("Name")).toHaveValue("Groceries");
  await sheet.getByLabel("Name").fill("Supermarket");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText(
    "Groceries is now Supermarket.",
  );
  await expect(
    expense.getByRole("button", { name: "Supermarket", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New category" }).click();
  const create = page.getByRole("dialog", { name: "New expense category" });
  await create.getByLabel("Name", { exact: true }).fill("Pets");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create).toBeHidden(ROUND_TRIP);
  await expect(
    expense.getByRole("button", { name: "Pets", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New category" }).click();
  // The one New button asks which tree in its sheet.
  await page.getByRole("radio", { name: "Income" }).click();
  const createIncome = page.getByRole("dialog", {
    name: "New income category",
  });
  await createIncome.getByLabel("Name", { exact: true }).fill("Royalties");
  await createIncome.getByRole("button", { name: "Save category" }).click();
  await expect(createIncome).toBeHidden(ROUND_TRIP);
  await expect(
    income.getByRole("button", { name: "Royalties", exact: true }),
  ).toBeVisible();

  await page.goto("/tags");
  const tags = page.getByRole("table", { name: "Tags", exact: true });
  await expect(tags.getByRole("columnheader")).toHaveText([
    "Name",
    "Transactions",
    "Actions",
  ]);
  await expect(tags.getByRole("row", { name: /Coffee/ })).toContainText("1");
  const width = page.viewportSize()?.width ?? 0;
  expect((await boxOf(tags)).width).toBeLessThan(width / 2);
  await tags.getByRole("button", { name: "Coffee", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit tag", exact: true });
  await editor.getByLabel("Name", { exact: true }).fill("Espresso");
  await editor.getByRole("button", { name: "Save name" }).click();
  await expect(editor).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText("Coffee is now Espresso.");
  await expect(
    tags.getByRole("button", { name: "Espresso", exact: true }),
  ).toBeVisible();
});

test("desktop management tables sort by their columns and each row has a menu", {
  tag: "@matrix",
}, async ({ page, baseURL }) => {
  test.skip(!isDesktop(page), "Phone keeps its lists");
  if (!baseURL) {
    throw new Error("The browser test has no client origin");
  }
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await seedTaggedGroceriesEntry(page, baseURL);
  const alpha = await page.request.post(
    `${process.env.VITE_API_ORIGIN}/v1/tags`,
    {
      headers: { origin: baseURL, "idempotency-key": randomUUID() },
      data: { name: "Alpha" },
    },
  );
  expect(alpha.ok()).toBe(true);

  await page.goto("/categories");
  const expense = page.getByRole("table", { name: "Expense categories" });
  const names = expense.locator("[data-category-row]");
  const nameHeader = expense.getByRole("columnheader", { name: "Name" });
  await expect(expense.getByRole("button", { name: "Entries" })).toBeVisible();
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(names.first()).toHaveText("Education");
  // A child stays under its parent, sorted among its siblings.
  const ascending = await names.allTextContents();
  const food = ascending.indexOf("Food & Drink");
  expect(ascending.slice(food, food + 5)).toEqual([
    "Food & Drink",
    "Coffee & snacks",
    "Delivery",
    "Groceries",
    "Restaurants",
  ]);
  await nameHeader.getByRole("button").click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(names.first()).toHaveText("Uncategorized");
  await expect(
    expense.getByRole("button", { name: /rows per page/i }),
  ).toHaveCount(0);

  await expense.getByRole("button", { name: "Actions for Groceries" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit category" });
  await expect(sheet.getByLabel("Name")).toHaveValue("Groceries");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  // The menu closed with the sheet's opening; focus goes back to the row.
  await expect(
    expense.getByRole("button", { name: "Groceries", exact: true }),
  ).toBeFocused();

  await page.goto("/tags");
  const tags = page.getByRole("table", { name: "Tags", exact: true });
  const tagNames = tags.locator("[data-tag-row]");
  await tags.getByRole("button", { name: "Transactions" }).click();
  await expect(tagNames).toHaveText(["Coffee", "Alpha"]);
  await tags.getByRole("button", { name: "Transactions" }).click();
  await expect(tagNames).toHaveText(["Alpha", "Coffee"]);

  // The menu works from the keyboard alone.
  await tags.getByRole("button", { name: "Actions for Alpha" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("dialog", { name: "Edit tag", exact: true });
  await expect(editor.getByLabel("Name", { exact: true })).toHaveValue("Alpha");
});
