import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

/** The element's box, failing the test when it has none rather than comparing nulls. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
}

/** The 15th of the month before `today`'s, and that month's short name. */
function lastMonthOf(today: string) {
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return {
    date: `${start.toISOString().slice(0, 7)}-15`,
    name: start.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("the tiles compare this month with last, and the cash flow spans six or twelve months", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its Today card");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2025-01-01",
  });
  const lastMonth = lastMonthOf(todayIn({ timeZone: APP_TIME_ZONE }));
  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await page.getByLabel("Amount").fill("300");
  await chooseDate(page.getByLabel("Date", { exact: true }), lastMonth.date);
  await page.getByRole("button", { name: "Save +฿300.00 · Cash" }).click();
  await expectSavedRecord(page);
  // The form's default date is Bangkok today, in this month.
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("80");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expectSavedRecord(page);

  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Total balance" }),
  ).toContainText("฿1,220.00");
  const tile = (name: string) =>
    page.getByRole("region", { name, exact: true });
  await expect(tile("Income")).toContainText("฿0.00");
  await expect(tile("Income")).toContainText(`−฿300.00 from ${lastMonth.name}`);
  await expect(tile("Net expenses")).toContainText("฿80.00");
  await expect(tile("Net expenses")).toContainText(
    `+฿80.00 from ${lastMonth.name}`,
  );
  await expect(tile("Net")).toContainText("−฿80.00");
  await expect(tile("Net")).toContainText(`−฿380.00 from ${lastMonth.name}`);
  await expect(page.getByRole("region", { name: "Today" })).toHaveCount(0);

  const cashFlow = page.getByRole("region", { name: "Cash flow" });
  const months = cashFlow.getByRole("group", {
    name: "Choose a month to read",
  });
  await expect(cashFlow.getByRole("radio", { name: "6 months" })).toBeChecked();
  await expect(cashFlow.getByRole("link", { name: "Reports" })).toHaveAttribute(
    "href",
    /\/reports\?month=\d{4}-\d{2}$/,
  );
  await expect(months.getByRole("button")).toHaveCount(6);
  await cashFlow.getByRole("radio", { name: "12 months" }).click();
  await expect(months.getByRole("button")).toHaveCount(12);
  await expect(
    cashFlow.getByRole("table", {
      name: "Income and net expenses for each of the last twelve months",
    }),
  ).toBeAttached();
  await cashFlow.getByRole("radio", { name: "6 months" }).click();
  await expect(months.getByRole("button")).toHaveCount(6);

  // Reports shows Home's cached monthly reports at once; held answers would
  // otherwise keep its loader waiting past the assertion's timeout.
  await page.route("**/v1/reports/monthly?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.continue();
  });
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Reports", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Net", exact: true }),
  ).toContainText("−฿80.00", { timeout: 2_000 });
});

test("the desktop grid lines the figures, cash flow, categories, wallets and records in rows", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its single column");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Old card",
    openingAmount: "50",
    openingDate: "2026-09-01",
  });
  await page.getByRole("link", { name: "Old card", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("80");
  await page.getByLabel("Note (optional)", { exact: true }).fill("Lunch");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  const saved = await expectSavedRecord(page);
  const savedId = (await saved.locator("a").first().getAttribute("href"))
    ?.split("/")
    .pop();
  if (!savedId) {
    throw new Error("Missing saved expense link");
  }

  await page.goto(`/?created=${savedId}`);
  const total = page.getByRole("region", { name: "Total balance" });
  const netExpenses = page.getByRole("region", { name: "Net expenses" });
  await expect(total).toContainText("฿970.00");
  await expect(netExpenses).toContainText("฿80.00");
  // Row 1: Spendable beside Income and Net expenses, Net beneath them, the
  // hero as tall as the pair and Net together.
  const totalBox = await boxOf(total);
  const [incomeBox, netExpensesBox, netBox] = await Promise.all(
    ["Income", "Net expenses", "Net"].map((name) =>
      boxOf(page.getByRole("region", { name, exact: true })),
    ),
  );
  for (const box of [incomeBox, netExpensesBox]) {
    expect(box.y).toBeCloseTo(totalBox.y, 0);
    expect(box.x).toBeGreaterThan(totalBox.x + totalBox.width - 1);
  }
  expect(netBox.y).toBeGreaterThan(incomeBox.y + incomeBox.height);
  expect(netBox.width).toBeGreaterThan(incomeBox.width * 2);
  expect(netBox.y + netBox.height).toBeCloseTo(totalBox.y + totalBox.height, 0);
  const cashFlowBox = await boxOf(
    page.getByRole("region", { name: "Cash flow" }),
  );
  expect(cashFlowBox.y).toBeGreaterThan(totalBox.y + totalBox.height);

  // Row 2: spending by category beside the Wallets table.
  const categories = page.getByRole("region", { name: "Spending by category" });
  await expect(categories).toContainText("Uncategorized");
  await expect(categories).toContainText("฿80.00");
  const wallets = page.getByRole("region", { name: "Wallets" });
  const walletTable = wallets.getByRole("table");
  await expect(walletTable.getByRole("columnheader")).toHaveText([
    "Wallet",
    "Type",
    "Held as",
    "Balance",
  ]);
  const cashRow = walletTable.getByRole("row", { name: /Cash/ });
  await expect(cashRow).toContainText("Spendable");
  await expect(cashRow).toContainText("฿920.00");
  await expect(walletTable.getByRole("row", { name: /Old card/ })).toHaveCount(
    0,
  );
  await expect(
    walletTable.getByRole("row", { name: /Total balance/ }),
  ).toContainText("฿970.00");
  await expect(wallets).toContainText("1 archived wallet not shown");
  const categoriesBox = await boxOf(categories);
  const walletsBox = await boxOf(wallets);
  expect(walletsBox.y).toBeCloseTo(categoriesBox.y, 0);
  expect(walletsBox.height).toBeCloseTo(categoriesBox.height, 0);
  expect(categoriesBox.y).toBeGreaterThan(cashFlowBox.y + cashFlowBox.height);

  // Row 3: the records as a table, the one just saved arriving with a fade.
  const recent = page.getByRole("region", { name: "Recent transactions" });
  const recentTable = recent.getByRole("table");
  await expect(recentTable.getByRole("columnheader")).toHaveText([
    "Date",
    "Category",
    "Wallet",
    "Tags",
    "Note",
    "Amount",
  ]);
  const row = recentTable.locator("[data-saved]");
  await expect(row).toContainText("Uncategorized");
  await expect(row).toContainText("Cash");
  await expect(row).toContainText("Lunch");
  await expect(row).toContainText("−฿80.00");
  expect((await boxOf(recent)).y).toBeGreaterThan(
    walletsBox.y + walletsBox.height,
  );
  await row.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/transactions/${savedId}$`));

  await page.goto("/");
  await page.getByRole("link", { name: "All transactions" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});
