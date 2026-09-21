import {
  APP_TIME_ZONE,
  addDays,
  formatCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.setTimeout(120_000);

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("records an expense and an income with the default wallet and chosen categories", async ({
  page,
}) => {
  await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(today, -3),
  });

  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await expect(page.getByRole("radio", { name: "Expense" })).toBeChecked();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Uncategorized",
  );
  await expect(page.getByRole("button", { name: "Today" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Wallet", { exact: true })).toContainText(
    "Cash",
  );

  const category = page.getByRole("button", { name: /^Category/ });
  await category.click();
  await page
    .getByRole("dialog", { name: "Expense category" })
    .getByRole("button", { name: "Groceries", exact: true })
    .click();
  await expect(category).toHaveText("Food & Drink › Groceries");

  await page.getByLabel("Amount").fill("120");
  await page.getByRole("button", { name: "Save −฿120.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?created=/);

  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Uncategorized",
  );
  const incomeCategory = page.getByRole("button", { name: /^Category/ });
  await incomeCategory.click();
  await page
    .getByRole("dialog", { name: "Income category" })
    .getByRole("button", { name: "Salary", exact: true })
    .click();
  await page.getByLabel("Amount").fill("250");
  await page.getByRole("button", { name: "Save +฿250.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?created=/);

  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿1,130.00");
});

test("validation keeps values, rejects a date before opening, and shows server errors", async ({
  page,
}) => {
  await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const openingDate = addDays(today, -3);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate,
  });
  await page.goto("/transactions/new");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter an amount" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("");

  const amount = page.getByLabel("Amount");
  await amount.fill("50");
  const date = page.getByLabel("Date", { exact: true });
  const beforeOpening = addDays(today, -4);
  await chooseDate(date, beforeOpening);
  await page.getByRole("button", { name: "Save −฿50.00 · Cash" }).click();
  await expect(page.locator("#transactionDate-error")).toContainText(
    `opened on ${formatCalendarDate(openingDate)}`,
  );
  await expect(page.locator("input[name=transactionDate]")).toHaveValue(
    beforeOpening,
  );
  await expect(amount).toHaveValue("50");

  await chooseDate(date, today);
  await page.route("**/v1/transactions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 409,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:bookkeeping:problem:idempotency-conflict",
        title: "Submission conflict",
        status: 409,
        code: "idempotency-conflict",
        detail: "This submission was already saved with different details.",
      }),
    });
  });
  await page.getByRole("button", { name: "Save −฿50.00 · Cash" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "already saved with different details",
  );
  await expect(amount).toHaveValue("50");
  await expect(page).toHaveURL(/\/transactions\/new$/);
});

test("creating a category inline selects it for the entry", async ({
  page,
}) => {
  await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "100",
    openingDate: addDays(today, -3),
  });
  await page.goto("/transactions/new");

  await page.getByRole("button", { name: /^Category/ }).click();
  const picker = page.getByRole("dialog", { name: "Expense category" });
  await picker
    .getByRole("button", { name: "New category", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "New expense category" });
  await create.getByLabel("Name", { exact: true }).fill("Coffee shops");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create).toBeHidden();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Coffee shops",
  );

  await page.getByLabel("Amount").fill("20");
  await page.getByRole("button", { name: "Save −฿20.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?created=/);
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿80.00");
});

test("a date that becomes future at Bangkok midnight keeps the chosen value and names the problem", async ({
  page,
}) => {
  await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: addDays(today, -3),
  });

  await page.clock.install({
    time: new Date(`${today}T12:00:00+07:00`),
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("50");
  await page.getByRole("button", { name: "Today" }).click();
  await page.clock.setFixedTime(
    new Date(`${addDays(today, -1)}T12:00:00+07:00`),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Today" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.getByRole("button", { name: "Save −฿50.00 · Cash" }).click();
  await expect(page.locator("#transactionDate-error")).toHaveText(
    "The date cannot be in the future",
  );
  await expect(page.locator("input[name=transactionDate]")).toHaveValue(today);
});

test("without an active wallet the form offers wallet management and creation", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/transactions/new");
  await expect(
    page.getByRole("heading", { name: "No active wallets" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Create or unarchive a wallet" })
    .click();
  await expect(page).toHaveURL(/\/wallets$/);
  await page.goBack();
  await page.getByRole("link", { name: "Create a wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/new$/);
});
