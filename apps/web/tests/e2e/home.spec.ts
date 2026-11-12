import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

/** The element's box, failing the test when it has none rather than comparing nulls. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("Home shows the total, Today, this month and the latest entries", async ({
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
  // An earlier day of the month keeps Today's figures apart from This
  // month's. On the 1st no earlier day exists in the month, so the entry
  // falls on today and both cards count it.
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const earlier = `${today.slice(0, 7)}-01`;
  const earlierIsToday = earlier === today;
  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await page.getByLabel("Amount").fill("300");
  await chooseDate(page.getByLabel("Date", { exact: true }), earlier);
  await page.getByRole("button", { name: "Save +฿300.00 · Cash" }).click();
  await expectSavedRecord(page);
  // The next two entries take the form's default date, Bangkok today.
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("80");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expectSavedRecord(page);
  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await page.getByLabel("Amount").fill("500");
  await page.getByRole("button", { name: "Save +฿500.00 · Cash" }).click();
  await expectSavedRecord(page);

  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Home", level: 1 }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const total = page.getByRole("region", { name: "Total balance" });
  await expect(total).toContainText("฿1,920.00");
  await expect(total).toContainText("Across 2 wallets");

  const summary = page.getByRole("region", { name: "Summary" });
  const dayCard = summary.getByRole("region", { name: "Today" });
  await expect(dayCard).toBeInViewport({ ratio: 0.9 });
  await expect(dayCard).toContainText(
    earlierIsToday ? "Income฿800.00" : "Income฿500.00",
  );
  await expect(dayCard).toContainText("Net expenses฿80.00");
  await expect(dayCard).toContainText(
    earlierIsToday ? "Net฿720.00" : "Net฿420.00",
  );
  const todayDot = page.getByRole("button", { name: "Today" });
  const monthDot = page.getByRole("button", { name: "This month" });
  await expect(todayDot).toHaveAttribute("aria-current", "true");

  await monthDot.click();
  const month = summary.getByRole("region", { name: "This month" });
  await expect(month).toBeInViewport({ ratio: 0.9 });
  await expect(monthDot).toHaveAttribute("aria-current", "true");
  await expect(todayDot).not.toHaveAttribute("aria-current", "true");
  await expect(month).toContainText("Income฿800.00");
  await expect(month).toContainText("Net expenses฿80.00");
  await expect(month).toContainText("Net฿720.00");

  const recent = page.getByRole("region", { name: "Recent transactions" });
  const rows = recent.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  // Newest first: the income was recorded last.
  await expect(rows.first()).toContainText("+฿500.00");
  await rows.nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+$/);

  await page.goto("/");
  await page.getByRole("link", { name: "All transactions" }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL(`/transactions?from=${today}&to=${today}`);

  await page.goto("/");
  await page.getByRole("button", { name: "This month" }).click();
  await page.getByRole("link", { name: "This month" }).click();
  const thisMonth = today.slice(0, 7);
  await expect(page).toHaveURL(`/reports?month=${thisMonth}`);
  // Income is the report's first figure.
  await expect(page.getByRole("definition").first()).toHaveText("฿800.00");
});

test("moving between summary cards shifts nothing around them", {
  tag: "@matrix",
}, async ({ page }) => {
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const earlier = `${today.slice(0, 7)}-01`;
  // On the first day there is no earlier day this month to populate only its card.
  test.skip(earlier === today, "Today needs an empty day in a busy month");
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
  await page.getByLabel("Amount").fill("80");
  await chooseDate(page.getByLabel("Date", { exact: true }), earlier);
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expectSavedRecord(page);
  await page.goto("/");

  const summary = page.getByRole("region", { name: "Summary" });
  const dayCard = summary.getByRole("region", { name: "Today" });
  const monthCard = summary.getByRole("region", { name: "This month" });
  // Wallets sits beneath the strip at every width.
  const wallets = page.getByRole("region", { name: "Wallets" });
  await expect(wallets).toBeVisible();
  // An empty Today draws empty bars, so it matches the busy month.
  const dayBox = await boxOf(dayCard);
  expect(dayBox.height).toBe((await boxOf(monthCard)).height);
  const total = page.getByRole("region", { name: "Total balance" });
  const walletsY = (await boxOf(wallets)).y;
  // Measured from the hero, because the click below may scroll the page.
  const walletsOffset = walletsY - (await boxOf(total)).y;

  // Each dot keeps its whole 44px target clear of both cards around it.
  const monthDot = page.getByRole("button", { name: "This month" });
  const dotBox = await boxOf(monthDot);
  expect(dotBox.height).toBe(44);
  expect(dotBox.width).toBe(44);
  expect(dotBox.y).toBeGreaterThanOrEqual(dayBox.y + dayBox.height);
  expect(dotBox.y + dotBox.height).toBeLessThanOrEqual(walletsY);

  await monthDot.click();
  await expect(monthCard).toBeInViewport({ ratio: 0.9 });
  await expect(monthDot).toHaveAttribute("aria-current", "true");
  expect((await boxOf(wallets)).y - (await boxOf(total)).y).toBe(walletsOffset);
  // The last card snaps flush with the page's column, not short of it.
  const totalX = (await boxOf(total)).x;
  await expect
    .poll(async () => (await boxOf(monthCard)).x)
    .toBeCloseTo(totalX, 0);
});

test("with no wallets Home offers only wallet creation", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "No wallets yet" }),
  ).toBeVisible();
  await expect(page.getByText(/฿/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Summary" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Recent transactions" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Create your first wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/new$/);
});

test("loads without sample money, then reads an empty ledger as empty", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.route("**/v1/reports/daily?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page.getByText("Loading your records…")).toBeAttached();
  await expect(page.getByText(/฿/)).toHaveCount(0);

  const day = page.getByRole("region", { name: "Today" });
  await expect(day).toContainText("Income฿0.00");
  await expect(day).toContainText("Net expenses฿0.00");
  await expect(day).toContainText("Net฿0.00");
  const recent = page.getByRole("region", { name: "Recent transactions" });
  await expect(recent).toContainText("No transactions yet");
  await expect(recent.getByRole("listitem")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "All transactions" }),
  ).toHaveCount(0);
});
