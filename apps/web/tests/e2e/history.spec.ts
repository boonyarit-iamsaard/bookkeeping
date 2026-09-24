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
  await page.goto("/transactions");
  const sheet = page.getByRole("dialog", { name: "Filter transactions" });
  const chips = page.getByRole("list", { name: "Active filters" });
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await filter.click();
  await chooseOption(sheet.getByLabel("Type", { exact: true }), "Income");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/transactions\?type=income$/);
  await expect(page.getByText("No matching transactions")).toBeVisible();
  await expect(chips.getByRole("listitem")).toHaveText(["Income"]);
  await filter.click();
  await sheet.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(chips).toBeHidden();
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  // The sheet is a dialog: Escape closes it and focus returns to Filter.
  await filter.focus();
  await filter.press("Enter");
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(filter).toBeFocused();
  await filter.click();
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await chooseDate(sheet.getByLabel("From date"), addDays(today, -1));
  await chooseDate(sheet.getByLabel("To date"), today);
  await chooseOption(sheet.getByLabel("Filter wallet"), "Cash");
  await chooseOption(sheet.getByLabel("Type", { exact: true }), "Expense");
  // The first Uncategorized listed is the expense tree's.
  await chooseOption(sheet.getByLabel("Filter category"), "Uncategorized");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/\/transactions\?.*type=expense/);
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(page.getByText(/Recorded .*Bangkok/)).toBeVisible();
  // The address alone restores the filters, their chips and the sheet's values.
  await page.reload();
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(chips.getByRole("listitem")).toHaveCount(5);
  // A chip removes a filter; it is never the current page.
  await expect(chips.locator("[aria-current], .active")).toHaveCount(0);
  await page.getByRole("link", { name: "Remove filter Expense" }).click();
  await expect(page).not.toHaveURL(/type=/);
  await expect(page).toHaveURL(/walletId=/);
  await expect(chips.getByRole("listitem")).toHaveCount(4);
  await filter.click();
  await expect(sheet.getByLabel("Filter wallet")).toContainText("Cash");
  await expect(sheet.getByLabel("Type", { exact: true })).toContainText(
    "All types",
  );
  await page.keyboard.press("Escape");
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
  await page.getByRole("link", { name: "Back to Transactions" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test("invalid filter values stay visible and editable with field errors", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/transactions?from=2026-09-03&to=2026-09-01");
  await expect(page.getByRole("alert")).toHaveText(
    "From date must be on or before To date.",
  );
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByLabel("From date")).toHaveText("3 Sep 2026");
  await expect(page.locator("input[name=from]")).toHaveValue("2026-09-03");
  await expect(page.getByLabel("To date")).toHaveText("1 Sep 2026");
  await page.keyboard.press("Escape");
  await page.goto("/transactions?from=0000-01-01");
  await expect(page.getByRole("alert")).toHaveText("Choose a valid From date.");
  await expect(
    page.getByRole("list", { name: "Active filters" }).getByRole("listitem"),
  ).toHaveText(["From 0000-01-01"]);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Filter transactions" });
  await expect(
    sheet.getByRole("alert").filter({ hasText: "Choose a valid From date" }),
  ).toBeVisible();
  await expect(sheet.locator("input[name=from]")).toHaveValue("0000-01-01");
  await expect(
    sheet.getByRole("button", { name: "Apply filters" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(
    "/transactions?from=bogus&walletId=gone&categoryId=lost&type=7",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Choose a valid From date.",
  );
  await expect(page.getByRole("alert")).not.toContainText("on or before");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(sheet.getByLabel("From date")).toHaveText("bogus");
  await expect(sheet.locator("input[name=from]")).toHaveValue("bogus");
  await expect(sheet.getByLabel("Filter wallet")).toContainText("gone");
  await expect(sheet.getByLabel("Filter category")).toContainText("lost");
  await expect(sheet.getByLabel("Type", { exact: true })).toContainText("7");
  await expect(sheet.getByRole("alert")).toContainText(
    "Choose a valid From date",
  );
  await expect(sheet.getByRole("alert")).toContainText("Choose a valid wallet");
  await expect(sheet.getByRole("alert")).toContainText(
    "Choose a valid category",
  );
  await expect(sheet.getByRole("alert")).toContainText("Choose a valid type");
  await chooseOption(sheet.getByLabel("Type", { exact: true }), "Expense");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/type=expense/);
  await expect(page).toHaveURL(/walletId=gone/);
});
