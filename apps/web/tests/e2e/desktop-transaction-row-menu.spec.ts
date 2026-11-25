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

/** Cash with a 80.00 expense, a 60.00 expense refunded in full, and 500.00 income. */
async function seedLedger(page: Page) {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  const apiOrigin = process.env.VITE_API_ORIGIN;
  const headers = { origin: new URL(page.url()).origin };
  const read = async (path: string) =>
    itemsSchema.parse(
      await (
        await page.request.get(`${apiOrigin}/v1/${path}`, { headers })
      ).json(),
    ).items;
  const post = async (data: object) => {
    const response = await page.request.post(`${apiOrigin}/v1/transactions`, {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data,
    });
    expect(response.ok()).toBe(true);
    return idSchema.parse(await response.json()).id;
  };
  const cash = (await read("wallets")).find((wallet) => wallet.name === "Cash");
  const categories = await read("categories");
  const uncategorized = (kind: string) =>
    categories.find(
      (item) => item.name === "Uncategorized" && item.kind === kind,
    );
  if (!(cash && uncategorized("expense") && uncategorized("income"))) {
    throw new Error("The seeded wallet or category was not found");
  }
  const amount = (value: string) => ({ value, currency: "THB" });
  const common = { walletId: cash.id, note: "", tagIds: [] };
  await post({
    ...common,
    type: "expense",
    amount: amount("80.00"),
    categoryId: uncategorized("expense")?.id,
    transactionDate: "2026-09-10",
  });
  const refunded = await post({
    ...common,
    type: "expense",
    amount: amount("60.00"),
    categoryId: uncategorized("expense")?.id,
    transactionDate: "2026-09-11",
  });
  await post({
    walletId: cash.id,
    note: "",
    type: "refund",
    amount: amount("60.00"),
    refundOfTransactionId: refunded,
    transactionDate: "2026-09-12",
  });
  await post({
    ...common,
    type: "income",
    amount: amount("500.00"),
    categoryId: uncategorized("income")?.id,
    transactionDate: "2026-09-13",
  });
}

test("desktop history's row menu edits, refunds and deletes in place", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The row menu is desktop-only");
  await seedLedger(page);
  await page.goto("/transactions");
  const rows = page.locator("[data-transaction-row]");
  const row = (text: string) => rows.filter({ hasText: text });
  const menu = (text: string) =>
    row(text).getByRole("button", { name: /^Actions for/ });
  const items = page.getByRole("menuitem");

  // The menu works from the keyboard, and Escape returns focus to its button.
  await menu("80.00").focus();
  await page.keyboard.press("Enter");
  await expect(items.first()).toBeVisible();
  await expect(items).toHaveText(["Edit", "Refund", "Delete"]);
  await page.keyboard.press("Escape");
  await expect(items).toHaveCount(0);
  await expect(menu("80.00")).toBeFocused();

  // Edit opens the entry dialog over the table, which shows the Correction.
  await menu("80.00").click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit expense" });
  await expect(edit).toBeVisible();
  await edit.getByLabel("Amount").fill("70");
  await edit.getByRole("button", { name: "Save −฿70.00 · Cash" }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(row("70.00")).toHaveCount(1);
  await expect(row("80.00")).toHaveCount(0);

  // Refund records against the expense and lists the refund.
  await menu("70.00").click();
  await page.getByRole("menuitem", { name: "Refund" }).click();
  const refund = page.getByRole("dialog", { name: "Record refund" });
  await refund.getByLabel("Amount").fill("10");
  await refund.getByRole("button", { name: "Save +฿10.00 · Cash" }).click();
  await expect(refund).toHaveCount(0);
  await expect(page.getByText("Refund saved.")).toBeVisible();
  await expect(row("10.00").filter({ hasText: "Refund" })).toHaveCount(1);

  // A fully refunded expense offers no Refund, and cannot be deleted.
  await row("60.00")
    .filter({ hasNotText: "Refund" })
    .getByRole("button", { name: /^Actions for/ })
    .click();
  await expect(items).toHaveText(["Edit", "Delete"]);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const refused = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  await expect(refused).toContainText(
    "will leave the list and the wallet balance",
  );
  await refused.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(refused).toContainText("This expense has linked refunds");
  await refused.getByRole("button", { name: "Keep it" }).click();
  await expect(refused).toHaveCount(0);
  await expect(row("60.00")).toHaveCount(2);

  // Delete asks first, then the row leaves the table.
  await menu("500.00").click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Delete this income?",
  });
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByText("Transaction deleted.")).toBeVisible();
  await expect(row("500.00")).toHaveCount(0);
});
