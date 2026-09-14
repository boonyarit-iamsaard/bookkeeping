import { expect, test } from "@playwright/test";
import { APP_TIME_ZONE, addDays, todayIn } from "@/shared/helpers/dates";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// Reporting follows Bangkok even when the browser calendar is on another day.
test.use({ timezoneId: "America/Los_Angeles" });

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("filters and reports work together with dated wallet balances", async ({
  page,
}, testInfo) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions");
  await page.screenshot({
    path: testInfo.outputPath("history-before.png"),
    fullPage: true,
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("500");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/);
  await expect(page.locator("[data-saved]")).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("saved-history.png"),
    fullPage: true,
  });
  const expenseHref = await page.locator("[data-saved] a").getAttribute("href");
  if (!expenseHref) {
    throw new Error("Missing saved expense link");
  }
  await page.getByText("Filter history", { exact: true }).click();
  await chooseOption(page.getByLabel("Type", { exact: true }), "Income");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No matching transactions")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await page.getByText("Filter history", { exact: true }).focus();
  await page.getByText("Filter history", { exact: true }).press("Enter");
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await page.getByLabel("From date").fill(addDays(today, -1));
  await page.getByLabel("To date").fill(today);
  await chooseOption(page.getByLabel("Filter wallet"), "Cash");
  await chooseOption(page.getByLabel("Type", { exact: true }), "Expense");
  // The first Uncategorized listed is the expense tree's.
  await chooseOption(page.getByLabel("Filter category"), "Uncategorized");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(page.getByText(/Recorded .*Bangkok/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("history.png"),
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Monthly summary" }),
  ).toBeVisible();
  await expect(page.locator("[data-summary='grossExpenses']")).toContainText(
    "฿500.00",
  );
  await expect(page.locator("[data-summary='net']")).toContainText("−฿500.00");
  await page.getByLabel("Report month").fill("2026-08");
  await page.getByRole("button", { name: "Update report" }).click();
  await expect(page.locator("[data-summary='grossExpenses']")).toContainText(
    "฿0.00",
  );
  const currentMonth = today.substring(0, today.lastIndexOf("-"));
  await page.getByLabel("Report month").fill(currentMonth);
  await page.getByLabel("Balance date").fill("2026-08-31");
  await page.getByRole("button", { name: "Update report" }).click();
  await expect(page.locator("[data-balance-total]")).toContainText("฿0.00");
  await page.screenshot({
    path: testInfo.outputPath("summary.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(expenseHref);
  await expect(
    page.getByRole("heading", { name: "Expense", exact: true }),
  ).toBeVisible();
});

test("signed-out history and reports require authentication", async ({
  page,
}) => {
  for (const path of [
    "/transactions?walletId=00000000-0000-4000-8000-000000000001",
    "/dashboard?month=2026-09&asOf=2026-09-30",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { name: "Monthly summary" }),
    ).toHaveCount(0);
  }
});

test("invalid date filters and year zero keep editable controls with validation", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/transactions?from=2026-09-03&to=2026-09-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose valid filters" }),
  ).toBeVisible();
  await expect(page.getByLabel("From date")).toHaveValue("2026-09-03");
  await expect(page.getByLabel("To date")).toHaveValue("2026-09-01");
  await page.goto("/transactions?from=0000-01-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose valid filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
  await page.goto("/dashboard?month=0000-01&asOf=2026-09-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a valid month" }),
  ).toBeVisible();
  await expect(page.getByLabel("Balance date")).toHaveValue("2026-09-01");
});
