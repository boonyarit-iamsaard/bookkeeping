import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test.setTimeout(120_000);

const EXPENSE_COUNT = 51;

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

/** Cash with one expense more than the default page of 50, in September 2026. */
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
  for (let index = 0; index < EXPENSE_COUNT; index += 1) {
    const day = String((index % 28) + 1).padStart(2, "0");
    const response = await page.request.post(apiUrl("transactions"), {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data: {
        type: "expense",
        amount: { value: "10.00", currency: "THB" },
        walletId: cash,
        categoryId: category,
        transactionDate: `2026-09-${day}`,
        note: `Expense ${index + 1}`,
        tagIds: [],
      },
    });
    expect(response.ok()).toBe(true);
  }
  return { cash };
}

function rowsOf(page: Page) {
  return page.getByRole("list", { name: "Transactions" }).getByRole("listitem");
}

test("phone history and a wallet's page ask for the next numbered page", async ({
  page,
}) => {
  test.skip(isDesktop(page), "Desktop pages through the data table");
  const { cash } = await seedLedger(page);
  const older = page.getByRole("link", { name: "Older transactions" });

  // The phone reads its usual 50 rows while keeping the desktop settings.
  await page.goto(
    "/transactions?type=expense&pageSize=10&sort=amount&order=asc",
  );
  await expect(rowsOf(page)).toHaveCount(50);
  await older.click();
  await expect
    .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
    .toEqual({
      type: "expense",
      pageSize: "10",
      sort: "amount",
      order: "asc",
      page: "2",
    });
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Remove filter Expense" }),
  ).toBeVisible();

  // The last page has no older link.
  await expect(older).toHaveCount(0);

  // Removing a filter resets the page and the desktop still has its settings.
  await page.getByRole("link", { name: "Remove filter Expense" }).click();
  await expect
    .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
    .toEqual({ pageSize: "10", sort: "amount", order: "asc" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByText("Page 1 of 6")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Amount" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await page.setViewportSize({ width: 360, height: 780 });

  // A page past the end leads back to the last one.
  await page.goto("/transactions?type=expense&page=3");
  await expect(
    page.getByRole("heading", { name: "Page 3 is past the end" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to page 2" }).click();
  await expect(rowsOf(page)).toHaveCount(1);

  // A wallet's page holds the default 50, then the one left.
  await page.goto(`/wallets/${cash}?sort=amount&order=asc`);
  await expect(rowsOf(page)).toHaveCount(50);
  await older.click();
  await expect
    .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
    .toEqual({ sort: "amount", order: "asc", page: "2" });
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(older).toHaveCount(0);

  await page.goto(`/wallets/${cash}?page=3`);
  await expect(
    page.getByRole("heading", { name: "Page 3 is past the end" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to page 2" }).click();
  await expect(rowsOf(page)).toHaveCount(1);
});

test("an empty ledger offers a way back from an old page", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/transactions?page=9");
  await expect(
    page.getByRole("heading", { name: "Page 9 is past the end" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to page 1" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole("heading", { name: "Nothing recorded yet" }),
  ).toBeVisible();
});
