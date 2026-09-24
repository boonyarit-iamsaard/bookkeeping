import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(150_000);

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("reviews income, expense, refund, transfer, and wallet balances for chosen dates", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await createWalletThroughForm(page, {
    name: "Savings",
    openingAmount: "200",
    openingDate: "2026-09-01",
  });

  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("500");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-02");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expectSavedRecord(page);
  const expenseHref = await page.locator("[data-saved] a").getAttribute("href");
  if (!expenseHref) {
    throw new Error("Missing saved expense link");
  }

  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await page.getByLabel("Amount").fill("1000");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-03");
  await page.getByRole("button", { name: "Save +฿1,000.00 · Cash" }).click();
  await expectSavedRecord(page);

  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Transfer" }).click();
  await page.getByLabel("Amount").fill("200");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-04");
  await page
    .getByRole("button", { name: "Save ฿200.00 Cash → Savings" })
    .click();
  await expectSavedRecord(page);

  await page.goto(`${expenseHref}/refund`);
  await page.getByLabel("Amount").fill("100");
  await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-05");
  await page.getByRole("button", { name: "Save +฿100.00 · Cash" }).click();
  await expectSavedRecord(page);

  await page.goto("/wallets");
  await page.getByRole("link", { name: "Savings", exact: true }).click();
  await page.getByRole("link", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Archive wallet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unarchive wallet", exact: true }),
  ).toBeVisible();

  // Management is a form screen without the tab bar; Home carries it.
  await page.goto("/");
  const reportsLink = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Reports", exact: true });
  await reportsLink.click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page).toHaveTitle(/Reports/);
  await expect(reportsLink).toHaveAttribute("aria-current", "page");

  // The month picker applies as soon as a month is chosen.
  await page.getByLabel("Report month").click();
  await page.getByRole("button", { name: "August 2026", exact: true }).click();
  await expect(page).toHaveURL(/\/reports\?month=2026-08$/);
  await expect(page.locator('[data-summary="income"]')).toContainText("฿0.00");

  await page.getByLabel("Report month").click();
  await page
    .getByRole("button", { name: "September 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports\?month=2026-09$/);
  await chooseDate(page.getByLabel("Balance date"), "2026-09-03");
  // The balance date applies on pick, like the month.
  await expect(page).toHaveURL(/\/reports\?month=2026-09&asOf=2026-09-03$/);

  const expectedSummary = {
    income: "฿1,000.00",
    grossExpenses: "฿500.00",
    refunds: "฿100.00",
    netExpenses: "฿400.00",
    net: "฿600.00",
  };
  for (const [key, value] of Object.entries(expectedSummary)) {
    await expect(page.locator(`[data-summary="${key}"]`)).toContainText(value);
  }

  const overall = page.locator('[data-balance-row="Overall balance"]');
  await expect(overall).toContainText("Current฿1,800.00");
  await expect(overall).toContainText("3 Sep 2026฿1,700.00");
  const cash = page.locator('[data-balance-row="Cash"]');
  await expect(cash).toContainText("Current฿1,400.00");
  await expect(cash).toContainText("3 Sep 2026฿1,500.00");
  const savings = page.locator('[data-balance-row="Savings"]');
  await expect(savings).toContainText("Archived");
  await expect(savings).toContainText("Current฿400.00");
  await expect(savings).toContainText("3 Sep 2026฿200.00");
  await expect(page.locator('[data-summary="net"]')).toHaveClass(
    /font-semibold/,
  );
});

test("the month picker sits on the Reports title's row", {
  tag: "@matrix",
}, async ({ page }) => {
  await signUpFreshUser(page);
  // September is the longest month name the trigger has to fit.
  await page.goto("/reports?month=2026-09");

  const monthValue = page
    .getByLabel("Report month")
    .locator('[data-slot="month-value"]');
  await expect(monthValue).toHaveText("September 2026");
  const { scrollWidth, clientWidth } = await monthValue.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  const heading = await page
    .getByRole("heading", { name: "Reports", level: 1 })
    .boundingBox();
  const monthPicker = await page.getByLabel("Report month").boundingBox();
  const balanceDate = await page.getByLabel("Balance date").boundingBox();
  if (!heading || !monthPicker || !balanceDate) {
    throw new Error("Missing the Reports title bar or its balance date");
  }
  expect(monthPicker.y).toBeLessThan(heading.y + heading.height);
  expect(monthPicker.y + monthPicker.height).toBeGreaterThan(heading.y);
  expect(monthPicker.x).toBeGreaterThan(heading.x);
  expect(monthPicker.y).toBeLessThan(balanceDate.y);
});

test("shows loading without sample money, then the empty report", async ({
  page,
}) => {
  await signUpFreshUser(page);
  // Home has already read this month's report; a fresh load clears it.
  await page.goto("/wallets");
  await page.route("**/v1/reports/monthly?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Reports", exact: true })
    .click();
  await expect(page.getByText("Loading your report…")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reports", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/฿/)).toHaveCount(0);
  await expect(
    page.getByText("Add a wallet to begin tracking balances."),
  ).toBeVisible();
  await expect(
    page.getByText("No income, expenses or refunds recorded this month."),
  ).toBeVisible();
});

test("old dashboard links keep their values, and a failed report retries", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/dashboard?month=not-a-month&asOf=2026-02-30");
  await expect(page).toHaveURL(/\/reports\?month=not-a-month&asOf=2026-02-30$/);
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a valid month" }),
  ).toBeVisible();
  await expect(page.getByLabel("Report month")).toHaveText("Choose a month");
  await expect(page.getByLabel("Balance date")).toHaveText("Choose a date");

  let failed = false;
  await page.route("**/v1/reports/monthly?*", async (route) => {
    if (failed) {
      await route.continue();
      return;
    }
    failed = true;
    await route.fulfill({
      status: 500,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:bookkeeping:problem:internal-error",
        title: "Internal server error",
        status: 500,
        code: "internal-error",
      }),
    });
  });
  await page.goto("/dashboard?month=2026-09&asOf=2026-09-03");
  await expect(
    page.getByRole("heading", { name: "Your report could not load" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("filters");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "September 2026" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/reports\?month=2026-09&asOf=2026-09-03$/);
});
