import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(120_000);
const ROUND_TRIP = { timeout: 20_000 };

const collectionSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["income", "expense"]),
    }),
  ),
});

const walletCollectionSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

async function seedGroceriesEntry(
  page: Parameters<typeof signUpFreshUser>[0],
  baseURL: string,
): Promise<void> {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error("The browser test has no API origin");
  }
  const headers = { origin: baseURL };
  const [walletResponse, categoryResponse] = await Promise.all([
    page.request.get(`${apiOrigin}/v1/wallets`, { headers }),
    page.request.get(`${apiOrigin}/v1/categories`, { headers }),
  ]);
  expect(walletResponse.ok()).toBe(true);
  expect(categoryResponse.ok()).toBe(true);
  const wallets = walletCollectionSchema.parse(
    await walletResponse.json(),
  ).items;
  const categories = collectionSchema.parse(
    await categoryResponse.json(),
  ).items;
  const wallet = wallets[0];
  const category = categories.find((item) => item.name === "Groceries");
  if (!wallet || !category) {
    throw new Error("The seeded wallet or Groceries category was not found");
  }
  const response = await page.request.post(`${apiOrigin}/v1/transactions`, {
    headers: { ...headers, "idempotency-key": randomUUID() },
    data: {
      type: "expense",
      amount: { value: "45.00", currency: "THB" },
      walletId: wallet.id,
      categoryId: category.id,
      transactionDate: "2026-09-01",
      note: "Groceries",
    },
  });
  expect(response.ok()).toBe(true);
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("management preserves tree rules, moves entries, and creates categories", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("The browser test has no client origin");
  }
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await seedGroceriesEntry(page, baseURL);
  await page.goto("/categories");

  const tree = page.getByRole("list", { name: "Expense categories" });
  const rows = tree.getByRole("button");
  await expect(rows.first()).toHaveText(/Uncategorized/);
  await expect(rows.nth(1)).toHaveText(/Food & Drink/);
  await expect(rows.nth(2)).toHaveText(/Groceries.*1 entry/);

  await rows.nth(1).click();
  const sheet = page.getByRole("dialog", { name: "Edit category" });
  await expect(sheet.getByLabel("Name")).toHaveValue("Food & Drink");
  await expect(sheet.getByLabel("Name")).toBeFocused();
  await expect(sheet).toContainText(
    "A parent with children stays. Remove its 4 child categories first",
  );
  await expect(sheet.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  await sheet.getByLabel("Name").fill("Food");
  await sheet.getByLabel("Name").press("Enter");
  await expect(sheet).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText(
    "Food & Drink is now Food.",
  );
  await expect(rows.nth(1)).toHaveText(/^Food/);
  await expect(rows.nth(1)).toBeFocused();

  await rows.nth(2).click();
  await sheet.getByLabel("Name").fill(" restaurants ");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet.getByRole("alert")).toContainText(
    "already exists",
    ROUND_TRIP,
  );
  await expect(sheet.getByLabel("Name")).toHaveValue(" restaurants ");
  await expect(sheet).toContainText(
    "Removing Groceries moves its 1 entry, and any refunds linked to them, to Food.",
  );

  await sheet.getByRole("button", { name: "Remove…" }).click();
  await sheet.getByRole("button", { name: "Remove Groceries" }).click();
  await expect(sheet).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText(
    "Groceries removed. 1 entry moved to Food.",
  );
  await expect(page.getByRole("status")).toBeFocused();
  await expect(tree.getByRole("button", { name: "Groceries" })).toHaveCount(0);
  await expect(rows.nth(1)).toHaveText(/Food.*1 entry/);
  await expect(rows.nth(2)).toHaveText("›Restaurants");

  await rows.first().click();
  await expect(sheet.getByLabel("Name")).toHaveValue("Uncategorized");
  await expect(sheet.getByLabel("Name")).toHaveAttribute("readonly", "");
  await expect(sheet).toContainText(
    "Uncategorized cannot be removed or renamed",
  );
  await expect(sheet.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Browse all icons" }).click();
  await sheet.getByRole("radio", { name: "Sparkles" }).first().check();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Uncategorized has a new icon.",
    ROUND_TRIP,
  );

  await page.getByRole("radio", { name: "Income" }).click();
  const income = page.getByRole("list", { name: "Income categories" });
  await expect(income.getByRole("button", { name: "Salary" })).toBeVisible();
  await page.getByRole("button", { name: "New category" }).click();
  const create = page.getByRole("dialog", { name: "New income category" });
  await create.getByLabel("Name", { exact: true }).fill("Royalties");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText("Royalties created.");
  await expect(income.getByRole("button", { name: "Royalties" })).toBeVisible();
});
