import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.setTimeout(120_000);

const itemsSchema = z.object({
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

const TAG_NAMES = [
  "Anniversary dinner with the family",
  "Business travel reimbursable",
  "Christmas presents for everyone",
  "Dentist and other health costs",
  "Emergency household repairs",
];

/** Cash and Savings with an expense carrying five long tags, an income and a transfer. */
async function seedLedger(page: Page) {
  await signUpFreshUser(page);
  for (const name of ["Cash", "Savings"]) {
    await createWalletThroughForm(page, {
      name,
      openingAmount: "1000",
      openingDate: "2026-09-01",
    });
  }
  const apiOrigin = process.env.VITE_API_ORIGIN;
  const headers = { origin: new URL(page.url()).origin };
  const read = async (path: string) =>
    itemsSchema.parse(
      await (
        await page.request.get(`${apiOrigin}/v1/${path}`, { headers })
      ).json(),
    ).items;
  const post = async (path: string, data: object) => {
    const response = await page.request.post(`${apiOrigin}/v1/${path}`, {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data,
    });
    expect(response.ok()).toBe(true);
    return idSchema.parse(await response.json()).id;
  };
  const wallets = await read("wallets");
  const cash = wallets.find((wallet) => wallet.name === "Cash")?.id;
  const savings = wallets.find((wallet) => wallet.name === "Savings")?.id;
  const categories = await read("categories");
  const uncategorized = (kind: string) =>
    categories.find(
      (item) => item.name === "Uncategorized" && item.kind === kind,
    )?.id;
  if (!(cash && savings)) {
    throw new Error("The seeded wallets were not found");
  }
  const tagIds = [];
  for (const name of TAG_NAMES) {
    tagIds.push(await post("tags", { name }));
  }
  const amount = (value: string) => ({ value, currency: "THB" });
  await post("transactions", {
    type: "expense",
    amount: amount("80.00"),
    walletId: cash,
    categoryId: uncategorized("expense"),
    transactionDate: "2026-09-10",
    note: "Five tags",
    tagIds,
  });
  await post("transactions", {
    type: "income",
    amount: amount("500.00"),
    walletId: cash,
    categoryId: uncategorized("income"),
    transactionDate: "2026-09-11",
    note: "",
    tagIds: [],
  });
  await post("transactions", {
    type: "transfer",
    amount: amount("100.00"),
    walletId: cash,
    destinationWalletId: savings,
    transactionDate: "2026-09-12",
    note: "",
  });
}

test("desktop history's type filter link, column menu and one-line tags cell", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its month sections");
  await seedLedger(page);

  // No type tabs; a link with a type still narrows the table.
  await page.goto("/transactions?pageSize=10&type=expense");
  await expect(
    page.getByRole("navigation", { name: "Transaction type" }),
  ).toHaveCount(0);
  const table = page.getByRole("table", { name: "Transactions" });
  const rows = table.locator("[data-transaction-row]");
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Filters/ })).toHaveText(
    "Filters · 1",
  );
  await page.goto("/transactions?pageSize=10");
  await expect(rows).toHaveCount(3);

  // Each chosen tag counts once on the Filters button.
  const filters = page.getByRole("button", { name: /^Filters/ });
  await filters.click();
  const bar = page.getByRole("search", { name: "Filter transactions" });
  for (const name of TAG_NAMES.slice(0, 2)) {
    await bar.locator("label", { hasText: name }).click();
  }
  await expect(filters).toHaveText("Filters · 2");
  await page.keyboard.press("Escape");
  await page.goto("/transactions?pageSize=10");

  // Columns: Type is an icon after Date, its header read but not shown; Note
  // hidden by default; Date and Category always shown.
  const headers = table.locator("thead").getByRole("columnheader");
  await expect(headers).toHaveText([
    "Date",
    "Type",
    "Category",
    "Wallet",
    "Tags",
    "Amount",
    "Actions",
  ]);
  await expect(headers.nth(1).locator(".sr-only")).toHaveText("Type");
  const income = rows.filter({ hasText: "+" }).first();
  const incomeIcon = income.getByRole("button", { name: "Income" });
  await incomeIcon.hover();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText(
    "Income",
  );
  const iconRowHeight = (await income.boundingBox())?.height ?? 0;
  // No category or wallet title: the row link covers them, so none could show.
  await expect(
    table.locator('tbody a[href*="/transactions/"][title]'),
  ).toHaveCount(0);
  await expect(table.locator("tbody span[title]")).toHaveCount(0);
  await page.getByRole("button", { name: "Columns" }).click();
  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitemcheckbox", { name: "Date" }),
  ).toBeDisabled();
  await expect(
    menu.getByRole("menuitemcheckbox", { name: "Category" }),
  ).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemcheckbox", { name: "Type" }).click();
  await expect(headers.filter({ hasText: "Type" })).toHaveCount(0);
  // The icon's target overhangs its line rather than heightening the row.
  expect(
    Math.abs(((await income.boundingBox())?.height ?? 0) - iconRowHeight),
  ).toBeLessThanOrEqual(1);
  await menu.getByRole("menuitemcheckbox", { name: "Type" }).click();
  await menu.getByRole("menuitemcheckbox", { name: "Wallet" }).click();
  await menu.getByRole("menuitemcheckbox", { name: "Note" }).click();
  await page.keyboard.press("Escape");
  const chosen = [
    "Date",
    "Type",
    "Category",
    "Tags",
    "Note",
    "Amount",
    "Actions",
  ];
  await expect(headers).toHaveText(chosen);
  await page.reload();
  await expect(headers).toHaveText(chosen);
  // With Wallet hidden, a transfer's wallets move under Category.
  await expect(rows.filter({ hasText: "Transfer" })).toContainText("Savings");

  // Tags: one chip cut short, then +4 naming all five, on one line.
  const tagged = rows.filter({ hasText: "Five tags" });
  const cell = tagged.getByRole("list", { name: "Tags" });
  await expect(cell.getByRole("link")).toHaveCount(1);
  await expect(cell.getByRole("link").first()).toHaveAttribute(
    "title",
    TAG_NAMES[0] ?? "",
  );
  const more = cell.getByRole("button", {
    name: `4 more tags: ${TAG_NAMES.join(", ")}`,
  });
  await expect(more).toHaveText("+4");
  const untagged = rows.filter({ hasText: "500.00" });
  const [taggedBox, untaggedBox] = await Promise.all([
    tagged.boundingBox(),
    untagged.boundingBox(),
  ]);
  // One line: as tall as an untagged row, give or take sub-pixel rounding.
  expect(
    Math.abs((taggedBox?.height ?? 0) - (untaggedBox?.height ?? 0)),
  ).toBeLessThanOrEqual(1);
  await cell.getByRole("link").focus();
  await page.keyboard.press("Tab");
  await expect(more).toBeFocused();
  await expect(page.locator("[data-slot=tooltip-content]")).toHaveText(
    TAG_NAMES.join(", "),
  );
  await expect(
    rows.filter({ hasText: "Transfer" }).getByRole("list", { name: "Tags" }),
  ).toHaveCount(0);

  // A chip filters the history by its tag, keeping the view.
  await cell.getByRole("link").click();
  await expect(page).toHaveURL(/pageSize=10&tagId=/);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Five tags");
});
