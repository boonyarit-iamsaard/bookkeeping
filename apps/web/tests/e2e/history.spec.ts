import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(120_000);

// Reporting follows Bangkok even when the browser calendar is on another day.
test.use({ timezoneId: "America/Los_Angeles" });

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("filters apply through the address and open the saved record", {
  tag: "@matrix",
}, async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions");
  await expect(page.getByText("Nothing recorded yet")).toBeVisible();
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("500");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expectSavedRecord(page);
  await expect(page.locator("[data-saved]")).toBeInViewport();
  const expenseHref = await page.locator("[data-saved] a").getAttribute("href");
  if (!expenseHref) {
    throw new Error("Missing saved expense link");
  }
  await page.getByText("Filter history", { exact: true }).click();
  await chooseOption(page.getByLabel("Type", { exact: true }), "Income");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/\/transactions\?type=income$/);
  await expect(page.getByText("No matching transactions")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await page.getByText("Filter history", { exact: true }).focus();
  await page.getByText("Filter history", { exact: true }).press("Enter");
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await chooseDate(page.getByLabel("From date"), addDays(today, -1));
  await chooseDate(page.getByLabel("To date"), today);
  await chooseOption(page.getByLabel("Filter wallet"), "Cash");
  await chooseOption(page.getByLabel("Type", { exact: true }), "Expense");
  // The first Uncategorized listed is the expense tree's.
  await chooseOption(page.getByLabel("Filter category"), "Uncategorized");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/\/transactions\?.*type=expense/);
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(page.getByText(/Recorded .*Bangkok/)).toBeVisible();
  // The address alone restores the filters and keeps the disclosure open.
  await page.reload();
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(
    page.getByText("Filter history · Active filters", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter wallet")).toContainText("Cash");
  await expect(page.getByLabel("Type", { exact: true })).toContainText(
    "Expense",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(expenseHref);
  await expect(
    page.getByRole("heading", { name: "Expense", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("−฿500.00");
  const detail = page.getByRole("definition");
  await expect(detail.filter({ hasText: "Cash · Cash" })).toBeVisible();
  await expect(detail.filter({ hasText: "No note" })).toBeVisible();
  await expect(detail.filter({ hasText: "Bangkok time" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveAttribute(
    "href",
    `${expenseHref}/edit`,
  );
  await page.getByRole("link", { name: "Back to list" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test("invalid date filters and year zero keep editable controls with validation", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/transactions?from=2026-09-03&to=2026-09-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose valid filters" }),
  ).toBeVisible();
  await expect(page.getByLabel("From date")).toHaveText("3 Sep 2026");
  await expect(page.locator("input[name=from]")).toHaveValue("2026-09-03");
  await expect(page.getByLabel("To date")).toHaveText("1 Sep 2026");
  await page.goto("/transactions?from=0000-01-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose valid filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
});
