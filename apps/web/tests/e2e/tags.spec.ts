import { randomUUID } from "node:crypto";
import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(120_000);
const ROUND_TRIP = { timeout: 20_000 };

const walletCollectionSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

const categoryCollectionSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["income", "expense"]),
    }),
  ),
});

interface TagFixtureOptions {
  baseURL: string;
  transactionDate: string;
}

async function seedTagFixtures(
  page: Page,
  { baseURL, transactionDate }: Readonly<TagFixtureOptions>,
) {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error("The browser test has no API origin");
  }
  const headers = { origin: baseURL };
  const [walletResponse, categoryResponse, tagResponse] = await Promise.all([
    page.request.get(`${apiOrigin}/v1/wallets`, { headers }),
    page.request.get(`${apiOrigin}/v1/categories`, { headers }),
    page.request.post(`${apiOrigin}/v1/tags`, {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data: { name: "Coffee" },
    }),
  ]);
  expect(walletResponse.ok()).toBe(true);
  expect(categoryResponse.ok()).toBe(true);
  expect(tagResponse.ok()).toBe(true);
  const wallets = walletCollectionSchema.parse(
    await walletResponse.json(),
  ).items;
  const categories = categoryCollectionSchema.parse(
    await categoryResponse.json(),
  ).items;
  const wallet = wallets.find((item) => item.name === "Cash");
  const category = categories.find(
    (item) => item.name === "Uncategorized" && item.kind === "expense",
  );
  if (!wallet || !category) {
    throw new Error("The Cash wallet or expense Uncategorized was not found");
  }
  // An untagged row makes the history filter's effect visible.
  const expenseResponse = await page.request.post(
    `${apiOrigin}/v1/transactions`,
    {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data: {
        type: "expense",
        amount: { value: "25.00", currency: "THB" },
        walletId: wallet.id,
        categoryId: category.id,
        transactionDate,
        note: "Bus fare",
        tagIds: [],
      },
    },
  );
  expect(expenseResponse.ok()).toBe(true);
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("creates a tag inline on an expense, filters history, and merges it from Tags", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("The browser test has no client origin");
  }
  const { email } = await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(today, -1),
  });
  await seedTagFixtures(page, { baseURL, transactionDate: today });

  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("60");
  await page.getByLabel("Note").fill("Morning coffee");
  const tagsField = page.getByRole("button", { name: /^Tags/ });
  await tagsField.click();
  const picker = page.getByRole("dialog", { name: "Tags", exact: true });
  const search = picker.getByRole("searchbox", { name: "Search tags" });
  await search.fill("Coffee");
  for (const key of ["Home", "End"]) {
    await search.focus();
    await search.press(key);
    await expect(search).toBeFocused();
  }
  await search.focus();
  await search.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
  });
  const coffeeOption = picker.getByRole("button", { name: /^Coffee/ });
  await expect(coffeeOption).toHaveAttribute("aria-pressed", "false");
  await expect(search).toHaveValue("Coffee");
  await search.press("ArrowDown");
  await expect(coffeeOption).toBeFocused();
  await coffeeOption.press("ArrowUp");
  await expect(search).toBeFocused();
  await search.fill("Corner cafe");
  await picker.getByRole("button", { name: /Create “Corner cafe”/ }).click();
  await expect(search).toHaveValue("", ROUND_TRIP);
  await expect(
    picker.getByRole("button", { name: /^Corner cafe/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "Done · 1 chosen" }).click();
  await expect(picker).toBeHidden();
  await expect(tagsField).toContainText("Corner cafe");
  await expect(page.getByLabel("Amount")).toHaveValue("60");
  await expect(page.getByLabel("Note")).toHaveValue("Morning coffee");
  await page.getByRole("button", { name: "Save −฿60.00 · Cash" }).click();
  const saved = await expectSavedRecord(page);
  await expect(saved.getByRole("list", { name: "Tags" })).toHaveText(
    "Corner cafe",
  );

  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("link", { name: "Transactions", exact: true }).click();
  const rows = page.locator("[data-transaction-row]");
  const coffee = rows.filter({ hasText: "Morning coffee" });
  const bus = rows.filter({ hasText: "Bus fare" });
  await expect(coffee).toBeVisible();
  await expect(bus).toBeVisible();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const filters = page.getByRole("dialog", { name: "Filter transactions" });
  await filters.getByText("Corner cafe", { exact: true }).click();
  await expect(
    filters.getByRole("checkbox", { name: "Corner cafe", exact: true }),
  ).toBeChecked();
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(filters).toBeHidden();
  await expect(page).toHaveURL(/tagId=/);
  const chips = page.getByRole("list", { name: "Active filters" });
  await expect(chips.getByRole("listitem")).toHaveText(["# Corner cafe"]);
  await expect(rows).toHaveCount(1);
  await expect(coffee).toBeVisible();
  await expect(bus).toHaveCount(0);
  await chips
    .getByRole("link", { name: "Remove filter # Corner cafe", exact: true })
    .click();
  await expect(page).not.toHaveURL(/tagId=/);
  await expect(chips).toBeHidden();
  await expect(bus).toBeVisible();

  // Reach management through the phone account sheet without dropping cached reads.
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  await account.getByRole("link", { name: "Tags", exact: true }).click();
  await expect(page).toHaveURL(/\/tags\/?$/);
  await expect(
    page.getByRole("heading", { name: "Tags", level: 1 }),
  ).toBeVisible();
  const catalog = page.getByRole("list", { name: "Tags", exact: true });
  await expect(catalog.getByRole("button", { name: /^Coffee/ })).toBeVisible();
  await catalog.getByRole("button", { name: /^Corner cafe/ }).click();
  const editor = page.getByRole("dialog", { name: "Edit tag", exact: true });
  await expect(editor.getByLabel("Name", { exact: true })).toBeFocused();
  await editor.getByLabel("Name", { exact: true }).fill("Coffee");
  await expect(editor).toContainText(
    "already exists. Saving merges Corner cafe into it",
  );
  await editor.getByRole("button", { name: "Merge tags", exact: true }).click();
  await expect(editor).toBeHidden(ROUND_TRIP);
  const notice = page.getByRole("status");
  await expect(notice).toHaveText("Corner cafe merged into Coffee.");
  await expect(notice).toBeFocused();
  await expect(catalog.getByRole("button")).toHaveCount(1);
  await expect(catalog.getByRole("button", { name: /^Coffee/ })).toBeVisible();

  await nav.getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(coffee.getByRole("list", { name: "Tags" })).toHaveText("Coffee");
  await expect(bus).toBeVisible();
  await coffee.getByRole("link").click();
  await expect(
    page.getByRole("link", { name: "Transactions tagged Coffee", exact: true }),
  ).toBeVisible();
});
